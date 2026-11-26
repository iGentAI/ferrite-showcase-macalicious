#!/usr/bin/env node
// Contacts and Calendar rows, batch 3, on the served desktop with real mouse input and each result read from the server
// or the drive: a card dragged from the list to Mail's To field, a message, the desktop and a Calendar event; a photo
// dragged from Photos onto a card, framed anew and kept across a reload; the birthday date picker; a note's spelling;
// Contacts > Accounts…; Help; Calendar's Print sheet and the page it hands the browser; an event dragged to the desktop
// as an .ics; Share Event; and an all-day event written in Tokyo read in Los Angeles.
//
//   node e2e/contacts-calendar-batch3-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { crc32, deflateSync } from "node:zlib";
import { options, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("contacts-calendar-batch3");
const { base } = options();
const id = Date.now().toString(36);
const person = (name) => ({
  name: `${name}${id}`,
  fullName: `${name} ${id}`,
  password: `tide-${id}-pool`,
});
const chris = person("cb");
const pat = person("pb");
const ADA = `Ada${id}`;
const PAT = `Pat${id}`;
const EVENT = `Survey ${id}`;
const FAIR = `Fair ${id}`;
const ADA_MAIL = `ada-${id}@example.com`;

/** A PNG, 200 by 100, its left half red and its right half blue. */
const PNG = (() => {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(200, 0);
  header.writeUInt32BE(100, 4);
  header.set([8, 2], 8);
  const line = Buffer.concat([
    Buffer.from([0]),
    Buffer.alloc(300, Buffer.from([220, 20, 20])),
    Buffer.alloc(300, Buffer.from([20, 20, 220])),
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: 100 }, () => line)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
})();

const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);
const url = (page, path) => new URL(path, page.url()).href;
const fetched = async (page, path) => (await page.request.get(url(page, path))).json();

const openMenu = async (page, title) => {
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: title, exact: true })
    .first()
    .click();
  await page.getByRole("menu").last().waitFor({ timeout: 5_000 });
};
const row = (page, name) =>
  page.getByRole("menu").last().locator('[role^="menuitem"]').filter({ hasText: name }).first();
const menu = async (page, title, name) => {
  await openMenu(page, title);
  await row(page, name).click();
};
const closeMenus = async (page) => {
  for (let tries = 0; tries < 4 && (await page.getByRole("menu").count()) > 0; tries += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }
};
const launch = async (page, name) => {
  await page
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${name}$`) }))
    .first()
    .click();
};

/** Moves a window by its title bar so that its corner stands at the point given. */
async function placeWindow(page, element, x, y) {
  const box = await element.boundingBox();
  const bars = element.locator(".mac-title-bar").first();
  const bar = (await bars.count()) > 0 ? await bars.boundingBox() : box;
  const grip = { x: bar.x + bar.width / 2, y: bar.y + 6 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + x - box.x, grip.y + y - box.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

const closeShell = async (page, windowId) => {
  const shell = page.locator(`[data-window-id="${windowId}"]`);
  await shell
    .getByRole("button", { name: /^close/i })
    .first()
    .click();
  await shell.waitFor({ state: "detached", timeout: 5_000 });
};

/** A press, a drag and a release, in steps, as a person does. */
async function dragFromTo(page, from, x, y) {
  const box = await from.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 8, { steps: 4 });
  await page.mouse.move(x, y, { steps: 14 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(250);
}
const middleOf = async (element) => {
  const box = await element.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const driveFile = async (page, match) =>
  (
    (await fetched(page, "/api/files/")).items ??
    (await fetched(page, "/api/files/")).entries ??
    []
  ).find((each) => match.test(each.name));
const driveText = (page, entry) =>
  page.evaluate(
    async ({ entry }) => {
      const reply = await fetch(
        `/api/files/content/${encodeURIComponent(entry.id)}?piece=0&count=8&version=${entry.version ?? 0}`,
        { credentials: "same-origin" },
      );
      return reply.ok ? reply.text() : `HTTP ${reply.status}`;
    },
    { entry },
  );

/** The colour at the middle of a card's picture, read from what the server keeps. */
const pictureMiddle = (page, card) =>
  page.evaluate(async (card) => {
    const reply = await fetch(`/api/contacts/pictures?ids=${encodeURIComponent(card)}`, {
      credentials: "same-origin",
    });
    const image = (await reply.json()).pictures?.[card]?.image;
    if (!image) return null;
    const element = new Image();
    element.src = image;
    await element.decode();
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(element, 0, 0);
    const [red, , blue] = context.getImageData(canvas.width / 4, canvas.height / 2, 1, 1).data;
    const [redEnd, , blueEnd] = context.getImageData(
      (canvas.width * 3) / 4,
      canvas.height / 2,
      1,
      1,
    ).data;
    return { left: red > blue ? "red" : "blue", right: redEnd > blueEnd ? "red" : "blue" };
  }, card);

await run({}, {}, async ({ person: open }) => {
  const other = await open("pat", pat);
  await other.context().close();

  const page = await open("chris", chris);
  await page.setViewportSize({ width: 3000, height: 1200 });
  const contacts = page.locator('.mac-contacts[aria-label="Contacts"]').first();
  const nameRow = (name) =>
    contacts.getByRole("listbox").getByRole("option").filter({ hasText: name }).first();

  // ---- Seed: two cards and an event of this week ------------------------------------------------
  await launch(page, "Contacts");
  await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 15_000 });
  const before = await fetched(page, "/api/contacts/cards");
  await page.request.put(url(page, "/api/contacts/cards"), {
    data: {
      rev: before.rev,
      cards: [
        ...(before.cards ?? []),
        {
          id: `card-ada-${id}`,
          account: "icloud",
          first: ADA,
          last: "Lovelace",
          birthday: "March 14",
          emails: [{ label: "home", value: ADA_MAIL }],
        },
        { id: `card-pat-${id}`, account: "icloud", first: PAT, last: "Person", user: pat.name },
      ],
    },
  });
  await page.reload({ waitUntil: "load" });
  await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 20_000 });

  const shelf = await contacts.boundingBox();
  const RIGHT = shelf.x + shelf.width + 20;

  // ---- Contacts > Accounts…, Help ---------------------------------------------------------------
  await menu(page, "Contacts", "Accounts…");
  step(
    "Accounts…: Contacts' menu opens System Preferences on Internet Accounts",
    await seen(() =>
      page
        .getByRole("region", { name: /Internet Accounts/ })
        .first()
        .isVisible(),
    ),
  );
  await closeShell(page, "system-preferences");
  await contacts.click({ position: { x: 300, y: 8 } });
  await openMenu(page, "Help");
  const helpSearch = page
    .getByRole("menu")
    .last()
    .getByRole("searchbox")
    .or(page.getByRole("menu").last().getByRole("textbox"))
    .first();
  step("Search field: Contacts' Help menu has one", await helpSearch.isVisible());
  await helpSearch.fill("Print");
  step(
    "Search field: typing finds Contacts' own menu rows",
    await seen(() => page.getByRole("menu").last().getByText(/Print/).first().isVisible()),
  );
  await helpSearch.fill("");
  await row(page, "Contacts Help").click();
  step(
    "Contacts Help opens Help Viewer",
    await seen(() => page.getByRole("region", { name: /Help/ }).first().isVisible()),
  );
  await shot(page, "cc3-contacts-help");
  await closeShell(page, "help-viewer");

  // ---- A card into Mail ------------------------------------------------------------------------
  await launch(page, "Mail");
  const mail = page.locator(".mac-mail").first();
  await mail.waitFor({ timeout: 15_000 });
  await placeWindow(page, mail, RIGHT, 640);
  await mail.getByRole("button", { name: "New Message" }).click();
  const compose = page.locator(".mac-mail-compose").first();
  await compose.waitFor({ timeout: 10_000 });
  await placeWindow(page, compose, RIGHT, 40);
  await page.waitForTimeout(300);
  await contacts.click({ position: { x: 300, y: 8 } });
  await nameRow(ADA).click();
  const to = compose.getByRole("listbox", { name: "To recipients" });
  const toAt = await middleOf(compose.getByLabel("To:"));
  await dragFromTo(page, nameRow(ADA), toAt.x, toAt.y);
  step(
    "Card into Mail or Messages: a card dropped on To gives its address, by a real mouse drag",
    await seen(async () => (await to.innerText()).includes(ADA_MAIL)),
    (await to.count()) > 0 ? await to.innerText() : "no recipients",
  );
  await shot(page, "cc3-card-in-to");
  const messageBody = compose.getByRole("textbox", { name: "Message" });
  const bodyAt = await middleOf(messageBody);
  await dragFromTo(page, nameRow(ADA), bodyAt.x, bodyAt.y);
  const strip = compose.getByRole("list", { name: "Attachments" });
  step(
    "Card into Mail or Messages: a card dropped on the message is attached as a vCard",
    await seen(async () => (await strip.count()) > 0 && /\.vcf/.test(await strip.innerText())),
  );
  await shot(page, "cc3-card-attached");

  // ---- A card to the desktop, as a real vCard file -----------------------------------------------
  await dragFromTo(page, nameRow(ADA), 60, 900);
  const vcard = await within(12_000, () => driveFile(page, new RegExp(`${ADA}.*\\.vcf$`)));
  const dropped = await driveFile(page, new RegExp(`${ADA}.*\\.vcf$`));
  step(
    "Card to Finder as a vCard: dropped on the desktop, a .vcf on the drive",
    vcard !== null && Boolean(dropped),
    dropped?.name,
  );
  const vcardText = dropped ? await driveText(page, dropped) : "";
  step(
    "Card to Finder as a vCard: the file reads as the card",
    vcardText.includes("BEGIN:VCARD") && vcardText.includes(ADA_MAIL),
  );

  // ---- A photo from Photos onto a card ---------------------------------------------------------
  await launch(page, "Photos");
  const photos = page.getByRole("region", { name: "Photos", exact: true }).first();
  await photos.waitFor({ timeout: 15_000 });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    photos.getByRole("button", { name: "Import", exact: true }).click(),
  ]);
  await chooser.setFiles({ name: `Halves ${id}.png`, mimeType: "image/png", buffer: PNG });
  const tile = photos.locator("[data-photo-id]").first();
  await tile.waitFor({ timeout: 20_000 });
  await placeWindow(page, photos, RIGHT, 500);
  await contacts.click({ position: { x: 300, y: 8 } });
  await nameRow(ADA).click();
  const head = contacts.locator(".mac-contacts-head").first();
  const headAt = await middleOf(head);
  await dragFromTo(page, tile, headAt.x, headAt.y);
  const adaId = `card-ada-${id}`;
  step(
    "Picture from Photos onto a card: on the server, the middle square of the photo",
    await seen(async () => {
      const middle = await pictureMiddle(page, adaId);
      return middle?.left === "red" && middle?.right === "blue";
    }, 15_000),
    JSON.stringify(await pictureMiddle(page, adaId)),
  );
  await shot(page, "cc3-photo-on-card");

  // ---- Crop and zoom ---------------------------------------------------------------------------
  await contacts.click({ position: { x: 300, y: 8 } });
  await menu(page, "Card", "Edit Custom Image");
  const frame = page.getByRole("img", { name: "Picture frame" });
  await frame.waitFor({ timeout: 5_000 });
  const frameAt = await middleOf(frame);
  await page.waitForTimeout(200);
  await page.mouse.move(frameAt.x, frameAt.y);
  await page.mouse.down();
  await page.mouse.move(frameAt.x + 170, frameAt.y, { steps: 6 });
  await page.mouse.up();
  await shot(page, "cc3-picture-editor");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  step(
    "Crop and zoom a picture: moved to the photo's left side, the server's picture is all red",
    await seen(async () => {
      const middle = await pictureMiddle(page, adaId);
      return middle?.left === "red" && middle?.right === "red";
    }),
    JSON.stringify(await pictureMiddle(page, adaId)),
  );
  await page.reload({ waitUntil: "load" });
  await contacts.locator(".mac-contacts-split:not([inert])").waitFor({ timeout: 20_000 });
  const kept = await pictureMiddle(page, adaId);
  step(
    "Crop and zoom a picture: still the framed picture after a reload",
    kept?.left === "red" && kept?.right === "red",
  );
  await nameRow(ADA).click();
  const shownPicture = contacts.locator(".mac-contacts-head .mac-contacts-picture-image");
  await shownPicture.waitFor({ timeout: 10_000 });
  await shownPicture.dblclick();
  step(
    "Crop and zoom a picture: a double click on the picture opens it again",
    await seen(() => frame.isVisible()),
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  // ---- Birthday, note, spelling ----------------------------------------------------------------
  await page.keyboard.press("Control+L");
  const picker = contacts
    .getByRole("group", { name: "birthday date" })
    .or(contacts.getByLabel("birthday date"))
    .first();
  await contacts.getByRole("textbox", { name: "birthday", exact: true }).fill("June 3, 1990");
  await picker.waitFor({ timeout: 5_000 });
  const yearSegment = picker.getByRole("spinbutton").first();
  await yearSegment.click();
  await page.keyboard.press("ArrowUp");
  const note = contacts.getByRole("textbox", { name: "note" });
  await note.click();
  await page.keyboard.type("Line one\nmisspeled wrod");
  step("Note: lines of text in a card being edited", (await note.inputValue()).includes("\n"));
  await openMenu(page, "Edit");
  await row(page, "Spelling and Grammar").click();
  await row(page, "Show Spelling and Grammar").click();
  const spelling = page.getByRole("dialog", { name: "Spelling and Grammar" });
  step("Spelling and Grammar: opens on the note", await seen(() => spelling.isVisible()));
  await shot(page, "cc3-spelling");
  await spelling
    .getByRole("button", { name: "Close" })
    .first()
    .click()
    .catch(() => {});
  await closeMenus(page);
  await note.click();
  await openMenu(page, "Edit");
  await row(page, "Substitutions").click();
  step(
    "Substitutions: the submenu offers Smart Quotes",
    await seen(() =>
      page
        .getByRole("menu")
        .last()
        .getByText(/Smart Quotes/)
        .isVisible(),
    ),
  );
  await closeMenus(page);
  await contacts.getByRole("button", { name: "Done", exact: true }).click();
  step(
    "Birthday: the date picker's step writes a date, read from the server",
    await seen(async () => {
      const card = (await fetched(page, "/api/contacts/cards")).cards.find(
        (each) => each.id === adaId,
      );
      return /1990|1991/.test(card?.birthday ?? "") && card.birthday !== "June 3, 1990";
    }),
  );
  step(
    "Note: both lines on the server",
    await seen(async () => {
      const card = (await fetched(page, "/api/contacts/cards")).cards.find(
        (each) => each.id === adaId,
      );
      return card?.note === "Line one\nmisspeled wrod";
    }),
  );

  // ---- Calendar: a card onto an event, Print, an event out to the desktop, Share Event --------------
  await launch(page, "Calendar");
  const calendar = page.getByRole("region", { name: "Calendar" }).first();
  await calendar.waitFor({ timeout: 15_000 });
  await placeWindow(page, calendar, RIGHT, 40);
  await page.keyboard.press("Control+2");
  const today = new Date();
  // The Wednesday of the week shown: a weekend's column can lie past the edge of the screen here.
  const at = (hour) =>
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - today.getDay() + 3,
      hour,
    ).getTime();
  const stored = await fetched(page, "/api/calendar/events");
  const homeId = (stored.calendars ?? [])[0]?.id ?? "home";
  await page.request.put(url(page, "/api/calendar/events"), {
    data: {
      ...stored,
      events: [
        ...(stored.events ?? []),
        {
          id: `event-${id}`,
          title: EVENT,
          start: at(9),
          end: at(10),
          calendar: homeId,
          location: "Pier",
        },
      ],
    },
  });
  await menu(page, "View", "Refresh Calendars");
  const block = calendar.locator("[data-event-id]").filter({ hasText: EVENT }).first();
  await block.waitFor({ timeout: 10_000 });
  await shot(page, "cc3-calendar-week");
  const eventAt = await middleOf(block);
  await contacts.click({ position: { x: 300, y: 8 } });
  await calendar.locator("[data-event-id]").first().waitFor();
  await dragFromTo(page, nameRow(PAT), eventAt.x, eventAt.y);
  const storedEvent = async () =>
    (await fetched(page, "/api/calendar/events")).events.find((each) => each.id === `event-${id}`);
  step(
    "Contact from Contacts onto invitees: a card with an account dropped on an event invites it, read from the server",
    await seen(async () => (await storedEvent())?.invitees?.includes(pat.name)),
    JSON.stringify((await storedEvent())?.invitees ?? []),
  );
  await dragFromTo(page, nameRow(ADA), eventAt.x, eventAt.y);
  await page.waitForTimeout(800);
  step(
    "Contact from Contacts onto invitees: a card with only an email is not invited",
    (await storedEvent())?.invitees?.length === 1,
  );

  await page.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  const printed = async (act) => {
    await page.evaluate(() => {
      window.printedPage = undefined;
    });
    await act();
    let html = "";
    await within(10_000, async () => {
      html = (await page.evaluate(() => window.printedPage)) ?? "";
      return html !== "";
    });
    return html;
  };
  await calendar.click({ position: { x: 500, y: 8 } });
  await menu(page, "File", /^Print/);
  const sheet = page.getByRole("dialog", { name: "Print" });
  await sheet.waitFor({ timeout: 5_000 });
  await shot(page, "cc3-print-sheet");
  step(
    "Print…: the sheet previews the view with the event",
    (await sheet.getByTitle("Preview").getAttribute("srcdoc")).includes(EVENT),
  );
  await sheet.getByRole("checkbox", { name: "Mini calendar" }).click();
  await sheet.getByRole("checkbox", { name: "Black and white" }).click();
  const weekPage = await printed(() => sheet.getByRole("button", { name: "Continue" }).click());
  step(
    "Print…: Continue hands the browser the week as a grid, with the event at its hour",
    weekPage.includes("cal-days") &&
      weekPage.includes(EVENT) &&
      weekPage.includes("top:198pt;height:22pt"),
  );
  step(
    "Print…: with the options chosen",
    weekPage.includes("cal-plain") && weekPage.includes("<caption>"),
  );
  await menu(page, "File", /^Print/);
  await sheet.waitFor({ timeout: 5_000 });
  await sheet
    .getByRole("button", { name: "View" })
    .or(sheet.getByRole("combobox", { name: "View" }))
    .first()
    .click();
  await page.getByRole("option", { name: "Month", exact: true }).click();
  const monthPage = await printed(() => sheet.getByRole("button", { name: "Continue" }).click());
  step("Print…: the month as a grid", monthPage.includes("cal-month") && monthPage.includes(EVENT));
  const pdf = await printed(() => menu(page, "File", /^Export as PDF/));
  step("Export as PDF…: the view as a grid", pdf.includes("cal-days") && pdf.includes(EVENT));

  await block.click();
  await page.keyboard.press("Escape");
  await dragFromTo(page, block, 60, 900);
  const icsName = new RegExp(`${EVENT}.*\\.ics$`);
  await within(12_000, () => driveFile(page, icsName));
  const ics = await driveFile(page, icsName);
  step("Event to Finder as .ics: on the drive", Boolean(ics), ics?.name);
  const icsText = ics ? await driveText(page, ics) : "";
  step(
    "Event to Finder as .ics: the file holds the event",
    icsText.includes("BEGIN:VCALENDAR") && icsText.includes(EVENT),
  );
  step(
    "Event to Finder as .ics: the event itself did not move",
    (await storedEvent())?.start === at(9),
  );

  await block.click({ button: "right" });
  await row(page, "Share Event").click();
  await row(page, "Mail").waitFor({ timeout: 5_000 });
  step(
    "Share an event: AirDrop stays dimmed with its reason",
    (await row(page, "AirDrop").getAttribute("data-reason"))?.includes("nearby"),
  );
  await row(page, "Mail").click();
  step(
    "Share an event: Mail gets the event as a file",
    await seen(async () => {
      for (const each of await page.locator(".mac-mail-compose").all()) {
        const files = each.getByRole("list", { name: "Attachments" });
        if ((await files.count()) > 0 && /\.ics/.test(await files.innerText())) return true;
      }
      return false;
    }),
  );
  await shot(page, "cc3-event-shared");

  // ---- The rows a person presses on the card ----------------------------------------------------
  await contacts.click({ position: { x: 300, y: 8 } });
  await nameRow(PAT).click();
  await page.waitForTimeout(200);
  const typedTo = page.locator(".mac-mail-compose").last().getByLabel("To:");
  await typedTo.fill(PAT.slice(0, 6));
  step(
    "Mail's address completion: Mail's own To field offers the card",
    await seen(() => page.getByRole("option").filter({ hasText: PAT }).first().isVisible()),
  );
  await typedTo.fill("");
  await page.keyboard.press("Escape");

  const composeCount = () => page.locator(".mac-mail-compose").count();
  const addressedTo = async (mailAddress) => {
    for (const each of await page.locator(".mac-mail-compose").all()) {
      const field = each.getByRole("listbox", { name: "To recipients" });
      if ((await field.count()) > 0 && (await field.innerText()).includes(mailAddress)) return true;
    }
    return false;
  };
  // Mail keeps one New Message window at a time, and a request waits for it to close.
  const closeComposes = async () => {
    for (let tries = 0; tries < 4 && (await composeCount()) > 0; tries += 1) {
      await page
        .locator(".mac-mail-compose")
        .last()
        .getByRole("button", { name: "Close" })
        .first()
        .dispatchEvent("click");
      await page
        .getByRole("button", { name: /Delete Draft|Don.t Save/ })
        .first()
        .click({ timeout: 1_500 })
        .catch(() => {});
      await page.waitForTimeout(300);
    }
  };
  await closeComposes();
  await launch(page, "Contacts");
  await nameRow(ADA).click();
  await contacts.locator('[data-contacts-menu="email-0"]').click();
  await page.getByRole("menu").last().locator('[role^="menuitem"]').first().click();
  step(
    "Label menus: the email label's first row opens a message to the address",
    await seen(() => addressedTo(ADA_MAIL)),
  );
  await closeComposes();
  await launch(page, "Contacts");
  const emailRow = contacts.getByText(ADA_MAIL).first();
  await emailRow.hover();
  await contacts
    .getByRole("button", { name: new RegExp(`${ADA_MAIL}$`) })
    .first()
    .click();
  step(
    "Badges on a hovered row: the row's badge opens a message to the address",
    await seen(() => addressedTo(ADA_MAIL)),
  );
  await closeComposes();

  await launch(page, "Contacts");
  await emailRow.dblclick();
  await openMenu(page, "Contacts");
  await row(page, "Services").click();
  await seen(async () => (await page.getByRole("menu").count()) >= 2, 3_000);
  const servicesShown = await page.getByRole("menu").last().innerText();
  step(
    "Services: with text selected on a card, the services that apply and not No Services Apply",
    !servicesShown.includes("No Services Apply") && servicesShown.trim() !== "",
    servicesShown.replace(/\s+/g, " ").slice(0, 120),
  );
  await closeMenus(page);
  await menu(page, "Edit", "Emoji & Symbols");
  const viewer = page.getByRole("dialog", { name: "Characters" });
  step(
    "Emoji & Symbols: pressed in Contacts, the Character Viewer opens",
    await seen(() => viewer.isVisible()),
  );
  await menu(page, "Edit", "Emoji & Symbols");
  await seen(async () => !(await viewer.isVisible()), 3_000);

  await launch(page, "Contacts");
  await menu(page, "Window", "Tile Window to Left of Screen");
  step(
    "Tile Window: pressed in Contacts, the window takes the left of the screen",
    await seen(async () => {
      const tiled = await contacts.boundingBox();
      return tiled.x < 5 && tiled.width > 1000;
    }),
    JSON.stringify(await contacts.boundingBox()),
  );
  await shot(page, "cc3-tiled");

  // ---- An all-day event written in Tokyo, read in Los Angeles -----------------------------------
  const browser = page.context().browser();
  const stateOf = await page.context().storageState();
  const tokyo = await browser.newContext({
    timezoneId: "Asia/Tokyo",
    storageState: stateOf,
    viewport: { width: 1440, height: 900 },
  });
  const tokyoPage = await tokyo.newPage();
  await tokyoPage.goto(`${base}/`, { waitUntil: "load" });
  await launch(tokyoPage, "Calendar");
  const tokyoCalendar = tokyoPage.getByRole("region", { name: "Calendar" }).first();
  await tokyoCalendar.waitFor({ timeout: 15_000 });
  // Wednesday of the week Los Angeles is in, so that its week view holds the day, at midnight in Tokyo.
  const laToday = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const inTokyo =
    Date.UTC(laToday.getFullYear(), laToday.getMonth(), laToday.getDate() - laToday.getDay() + 3) -
    9 * 3_600_000;
  const beforeFair = await fetched(tokyoPage, "/api/calendar/events");
  const saved = await tokyoPage.request.put(url(tokyoPage, "/api/calendar/events"), {
    data: {
      ...beforeFair,
      events: [
        ...beforeFair.events,
        {
          id: `fair-${id}`,
          title: FAIR,
          start: inTokyo,
          end: inTokyo + 86_400_000,
          allDay: true,
          timeZone: "Asia/Tokyo",
          calendar: homeId,
        },
      ],
    },
  });
  step("Ledger, all-day: the server keeps the zone it was written in", saved.ok());
  const kept2 = (await fetched(tokyoPage, "/api/calendar/events")).events.find(
    (each) => each.id === `fair-${id}`,
  );
  step("Ledger, all-day: read back with its zone", kept2?.timeZone === "Asia/Tokyo");
  await tokyo.close();
  const angeles = await browser.newContext({
    timezoneId: "America/Los_Angeles",
    storageState: stateOf,
    viewport: { width: 1440, height: 900 },
  });
  const angelesPage = await angeles.newPage();
  await angelesPage.goto(`${base}/`, { waitUntil: "load" });
  await launch(angelesPage, "Calendar");
  const angelesCalendar = angelesPage.getByRole("region", { name: "Calendar" }).first();
  await angelesCalendar.waitFor({ timeout: 15_000 });
  const shownBlock = angelesCalendar.locator("[data-event-id]").filter({ hasText: FAIR }).first();
  const tokyoDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    dateStyle: "full",
  }).format(new Date(inTokyo));
  await angelesPage.evaluate(() => {
    new MutationObserver((changes) => {
      for (const { addedNodes } of changes) {
        for (const node of addedNodes) {
          if (node.matches?.("iframe[data-textedit-print]")) window.printedPage = node.srcdoc;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await menu(angelesPage, "File", /^Print/);
  const laSheet = angelesPage.getByRole("dialog", { name: "Print" });
  await laSheet.waitFor({ timeout: 5_000 });
  await laSheet
    .getByRole("button", { name: "View" })
    .or(laSheet.getByRole("combobox", { name: "View" }))
    .first()
    .click();
  await angelesPage.getByRole("option", { name: "List", exact: true }).click();
  await laSheet.getByRole("button", { name: "Continue" }).click();
  let laPage = "";
  await within(10_000, async () => {
    laPage = (await angelesPage.evaluate(() => window.printedPage)) ?? "";
    return laPage !== "";
  });
  const heading = `<h2>${tokyoDate}</h2>`;
  const headingAt = laPage.indexOf(heading);
  const fairAt = laPage.indexOf(FAIR);
  step(
    "Ledger, all-day: in Los Angeles it is on the day it was written for in Tokyo",
    headingAt >= 0 && fairAt > headingAt,
    `${tokyoDate} ${headingAt} ${fairAt} ${await shownBlock.count()}`,
  );
  await angeles.close();
});

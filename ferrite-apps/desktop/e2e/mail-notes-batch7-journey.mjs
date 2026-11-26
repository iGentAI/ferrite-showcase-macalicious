#!/usr/bin/env node
// Batch 7 on Ferrite, in a real browser against the running app. Mail plays the chosen new-mail and action sounds
// (read as the tones Web Audio is asked for), Markup draws shapes and text into the file sent (read as the recipient's
// pixels), a picture from the computer's clipboard goes into a message and a note, a PDF dropped from Finder stands in
// a note, two tabs sending one message in one moment deliver it once, Stickies' Window > Zoom fits the note to its text,
// Services lists what it takes, Contacts' vCard Encoding writes Windows Latin 1, and a Voice Memos take runs on to the
// hour with what a take of an hour weighs going through the drive's upload route. Each is read from the server where
// it is stored, and across a reload where it persists. Chromium: only it lets a page write a picture to the clipboard.
//
//   node e2e/mail-notes-batch7-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]

import {
  closePreferences,
  compose,
  onServer,
  openPane,
  preferences,
  send,
  values,
  viewer,
} from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot, allow } = twoPeople("mail-notes-batch7");
// The two tabs' sends of one key: the server may answer the one that comes while the other is under way with a 503,
// and that window then says it cannot tell and sends again.
allow(/HTTP 503: \S*\/api\/mail\/send/);
allow(/console: Failed to load resource: the server responded with a status of 503/);
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `b7chris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `b7martin-${id}`, fullName: `Martin ${id}`, password };
const seen = (check, ms = 10_000) => within(ms, check).then((took) => took !== null);

const TONE = { Glass: 1318, Morse: 880, Bottle: 392, Tink: 1568 };
const tones = (page) => page.evaluate(() => window.__tones);
const clearTones = (page) =>
  page.evaluate(() => {
    window.__tones = [];
  });
const hears = (page, tone, ms = 20_000) => seen(async () => (await tones(page)).includes(tone), ms);

const openMail = async (page) => {
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await viewer(page).waitFor({ timeout: 15_000 });
};
const keepSettled = (page) => page.waitForTimeout(1_200);

/** A white PNG of 400 by 200, drawn by the browser, as bytes for a file input. */
const whitePicture = async (page) =>
  Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 200;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 400, 200);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return btoa(String.fromCharCode(...bytes));
    }),
    "base64",
  );

const pictureToClipboard = (page, picture) =>
  page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = new Blob([bytes], { type: "image/png" });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
  }, picture.toString("base64"));

/** A file on the person's drive, through the routes Finder's uploads use. */
const upload = (page, parent, name, type, base64, size) =>
  page.evaluate(
    async ({ parent, name, type, base64, size }) => {
      const json = { "content-type": "application/json" };
      const content = base64
        ? new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type })
        : new Blob(
            Array.from({ length: Math.ceil(size / 65536) }, () =>
              crypto.getRandomValues(new Uint8Array(65536)),
            ),
            { type },
          ).slice(0, size, type);
      const opened = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: content.size, type, existing: "fail" }),
      });
      const answer = await opened.json();
      if (!opened.ok) return { status: opened.status, answer };
      const piece = answer.piece_bytes ?? 192 * 1024;
      let index = 0;
      for (let from = 0; from < content.size; from += piece, index += 1) {
        const put = await fetch(`/api/files/uploads/${answer.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await content.slice(from, from + piece).arrayBuffer(),
        });
        if (!put.ok) return { status: put.status, index };
      }
      const done = await fetch(`/api/files/uploads/${answer.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
      return { status: done.status, pieces: index };
    },
    { parent, name, type, base64, size },
  );
const driveEntries = async (page) => {
  const reply = await page.request.get(new URL("/api/files/", page.url()).href);
  return (await reply.json()).entries ?? [];
};
const storedNotes = async (page) => {
  const reply = await page.request.get(new URL("/api/notes/data", page.url()).href);
  return (await reply.json()).data?.notes ?? [];
};
const storedStickies = async (page) => {
  const reply = await page.request.get(new URL("/api/stickies/data", page.url()).href);
  const body = await reply.json();
  return body.data?.notes ?? body.notes ?? [];
};

/** Send, again each second while the window still says a file is on its way up, as a person would. */
const sendWhenReady = (page) =>
  within(25_000, async () => {
    if ((await compose(page).count()) === 0) return true;
    await page.keyboard.press("Control+Shift+D");
    await page.waitForTimeout(1_000);
    return (await compose(page).count()) === 0;
  });

async function sounds(a, b) {
  await openPane(b, "General");
  await clearTones(b);
  await preferences(b).getByRole("combobox", { name: "New messages sound:" }).click();
  await b.getByRole("option", { name: "Glass", exact: true }).last().click();
  step("Preferences: choosing Glass plays it", await hears(b, TONE.Glass, 5_000));
  const box = preferences(b).getByRole("checkbox", { name: "Play sounds for other mail actions" });
  step(
    "Preferences: the sound rows are no longer dimmed",
    (await box.getAttribute("aria-disabled")) !== "true" && (await box.isChecked()),
  );
  const kept = async () => JSON.stringify(await values(b));
  step(
    "the choice is on the server",
    await seen(async () => (await kept()).includes('"sound":"Glass"')),
  );
  await keepSettled(b);
  await closePreferences(b);
  await b.reload({ waitUntil: "load" });
  await openMail(b);
  await openPane(b, "General");
  step(
    "and stays across a reload",
    (
      await preferences(b).getByRole("combobox", { name: "New messages sound:" }).innerText()
    ).includes("Glass"),
  );
  await closePreferences(b);

  await clearTones(a);
  await clearTones(b);
  await send(a, martin.name, `Sound ${id}`, "ring");
  step("the sender hears a sent message", await hears(a, TONE.Bottle, 5_000));
  step("the recipient hears the chosen sound as it arrives", await hears(b, TONE.Glass));
  await keepSettled(b);

  await clearTones(b);
  await viewer(b).getByRole("button", { name: "Get Mail" }).first().click();
  step("Get Mail with nothing new plays the no-mail sound", await hears(b, TONE.Tink, 8_000));

  await openPane(b, "General");
  await box.click();
  await preferences(b).getByRole("combobox", { name: "New messages sound:" }).click();
  await b.getByRole("option", { name: "None", exact: true }).last().click();
  await keepSettled(b);
  await closePreferences(b);
  await clearTones(b);
  await viewer(b).getByRole("button", { name: "Get Mail" }).first().click();
  await b.waitForTimeout(1_500);
  await send(a, martin.name, `Quiet ${id}`, "hush");
  const arrived = await seen(async () => Boolean(await onServer(b, `Quiet ${id}`)), 15_000);
  await b.waitForTimeout(1_500);
  step(
    "with Play sounds off and the sound on None, Mail plays nothing for new mail",
    arrived && !(await tones(b)).some((tone) => [TONE.Glass, TONE.Morse, TONE.Tink].includes(tone)),
    JSON.stringify(await tones(b)),
  );
}

async function markup(a, b, picture) {
  const subject = `Marked ${id}`;
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  const window = compose(a);
  await window.waitFor();
  await window.getByRole("button", { name: "Attach", exact: true }).click();
  await a
    .getByLabel("Files from this computer")
    .setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: picture });
  await a
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
    .catch(() => {});
  const open = window.getByLabel("Markup", { exact: true }).first();
  await seen(() => open.isEnabled(), 10_000);
  await open.click();
  const sheet = a.getByRole("dialog", { name: /^Markup: plan\.png/ });
  await sheet.waitFor({ timeout: 8_000 });
  const canvas = sheet.getByLabel("Picture to mark up");
  await seen(async () => (await canvas.evaluate((each) => each.width)) === 400);
  const place = await canvas.boundingBox();
  const at = (x, y) => [place.x + (x / 400) * place.width, place.y + (y / 200) * place.height];
  const dragOn = async (from, to) => {
    await a.mouse.move(...at(...from));
    await a.mouse.down();
    await a.mouse.move(...at(...to), { steps: 4 });
    await a.mouse.up();
  };
  const tool = (name) =>
    sheet.getByRole("toolbar", { name: "Markup tools" }).getByRole("button", { name, exact: true });
  step(
    "the sheet offers the sketch, shapes and text",
    (
      await Promise.all(
        ["Sketch", "Rectangle", "Oval", "Line", "Arrow", "Text"].map((name) => tool(name).count()),
      )
    ).every((count) => count === 1),
  );
  await tool("Rectangle").click();
  await dragOn([20, 20], [120, 80]);
  await tool("Blue").click();
  await tool("Arrow").click();
  await dragOn([200, 40], [380, 40]);
  await tool("Oval").click();
  await dragOn([20, 120], [120, 180]);
  await sheet.getByRole("button", { name: "Undo" }).click();
  await tool("Black").click();
  await tool("Text").click();
  await a.mouse.click(...at(200, 120));
  const text = sheet.getByLabel("Text to place on the picture");
  await text.waitFor({ timeout: 5_000 });
  await text.fill("WWWW");
  await text.press("Enter");
  await a.waitForTimeout(200);
  await shot(a, "b7-markup");
  await sheet.getByRole("button", { name: "Done" }).click();
  const strip = window.getByRole("list", { name: "Attachments" });
  await seen(
    async () =>
      (await strip.getByRole("listitem").count()) === 1 &&
      /KB|bytes/.test(await strip.innerText()) &&
      !/Uploading/.test(await strip.innerText()),
    15_000,
  );
  const to = window.getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await window.getByLabel("Subject:").fill(subject);
  await sendWhenReady(a);
  await shot(a, "b7-after-send");
  await seen(async () => Boolean(await onServer(b, subject)), 20_000);
  const sent = (await onServer(b, subject))?.attachments?.[0];
  // The server's own attachment route: the picture as Martin's window reads it.
  const pixels = await b.evaluate(
    async ({ url }) => {
      const reply = await fetch(url, { credentials: "same-origin" });
      if (!reply.ok) return { status: reply.status };
      const bitmap = await createImageBitmap(await reply.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const at = (x, y) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
      const data = context.getImageData(200, 120, 100, 30).data;
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 90) dark += 1;
      return {
        width: bitmap.width,
        rectEdge: at(20, 50),
        rectInside: at(70, 50),
        arrow: at(290, 40),
        undone: at(70, 120),
        dark,
      };
    },
    {
      url: sent
        ? `/api/mail/messages/${(await onServer(b, subject)).id}/attachments/${sent.id}?piece=0&count=8`
        : "/",
    },
  );
  step(
    "the file Martin receives holds the red rectangle, its inside left white",
    pixels.width === 400 &&
      pixels.rectEdge?.[0] > 180 &&
      pixels.rectEdge[2] < 120 &&
      pixels.rectInside?.[1] === 255,
    JSON.stringify(pixels),
  );
  step(
    "the blue arrow, the undone oval gone, and the black text drawn",
    pixels.arrow?.[2] > 180 &&
      pixels.arrow[0] < 120 &&
      pixels.undone?.[1] === 255 &&
      pixels.dark > 50,
  );
}

async function pasteInMail(a, b, picture) {
  const subject = `Pasted ${id}`;
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  const window = compose(a);
  await window.waitFor();
  await pictureToClipboard(a, picture);
  await window.getByRole("textbox", { name: "Message" }).click();
  await a.keyboard.press("Control+V");
  const strip = window.getByRole("list", { name: "Attachments" });
  step(
    "a picture on the computer's clipboard pastes into a New Message as an attachment",
    await seen(async () => (await strip.getByRole("listitem").count()) === 1, 10_000),
  );
  await seen(
    async () => /\d/.test(await strip.innerText()) && !/Uploading/.test(await strip.innerText()),
    15_000,
  );
  const to = window.getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await window.getByLabel("Subject:").fill(subject);
  await sendWhenReady(a);
  await seen(async () => Boolean(await onServer(b, subject)), 20_000);
  const sent = (await onServer(b, subject))?.attachments?.[0];
  // Chromium writes a clipboard picture out as its own PNG, so the bytes are not the file's own.
  const width = await b.evaluate(
    async (url) => {
      const reply = await fetch(url, { credentials: "same-origin" });
      return (await createImageBitmap(await reply.blob())).width;
    },
    `/api/mail/messages/${(await onServer(b, subject))?.id}/attachments/${sent?.id}?piece=0&count=8`,
  );
  step(
    "and it reaches the other person as the same picture",
    width === 400,
    `${sent?.name} ${sent?.size} bytes, ${width} wide`,
  );
}

async function twoTabs(a, b) {
  const subject = `Both tabs ${id}`;
  const second = await a.context().newPage();
  await second.addInitScript(recordTones);
  await second.goto(a.url(), { waitUntil: "load" });
  await second
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openMail(second);
  const write = async (page) => {
    await viewer(page).getByRole("button", { name: "New Message" }).click();
    const field = compose(page).getByLabel("To:");
    await field.click();
    await field.pressSequentially(martin.name);
    await field.press("Enter");
    await compose(page).getByLabel("Subject:").fill(subject);
    await compose(page).getByRole("textbox", { name: "Message" }).click();
    await page.keyboard.insertText("one copy");
  };
  await write(a);
  await write(second);
  const keys = [];
  const listen = (page) =>
    page.on("request", (request) => {
      if (/\/api\/mail\/send(\?|$)/.test(request.url()))
        keys.push(request.headers()["idempotency-key"]);
    });
  listen(a);
  listen(second);
  await Promise.all([
    a.keyboard.press("Control+Shift+D"),
    second.keyboard.press("Control+Shift+D"),
  ]);
  await seen(
    async () => (await compose(a).count()) === 0 && (await compose(second).count()) === 0,
    15_000,
  );
  const inbox = async () => {
    const reply = await b.request.get(new URL("/api/mail/messages", b.url()).href);
    return (await reply.json()).messages.filter((each) => each.subject === subject);
  };
  await seen(async () => (await inbox()).length > 0, 15_000);
  await sendWhenReady(a);
  await sendWhenReady(second);
  await b.waitForTimeout(2_000);
  step(
    "two tabs sending one message in one moment ask with one key",
    keys.length >= 2 && keys.every((key) => key === keys[0]),
    `${keys.length} requests`,
  );
  step(
    "and it is delivered once",
    (await inbox()).length === 1,
    `${(await inbox()).length} copies`,
  );
  const held = await a.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const opening = indexedDB.open("macalicious.mail.sending", 1);
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const all = opening.result.transaction("keys").objectStore("keys").count();
          all.onsuccess = () => {
            opening.result.close();
            resolve(all.result);
          };
        };
      }),
  );
  step("and no key stays in the browser once the server has answered", held === 0, `${held} kept`);
  await second.close();
}

async function notes(page, picture) {
  await openFromDock(page, "Notes", undefined).catch(() => {});
  const window = page.getByRole("region", { name: "Notes", exact: true }).first();
  await window.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 15_000 });
  await window
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "New Note" })
    .click();
  const editor = window.locator('[aria-label="Note"]:visible').first();
  await editor.waitFor({ timeout: 10_000 });
  const title = `Batch seven ${id}`;
  await editor.click();
  await page.keyboard.type(title);
  const stored = async () =>
    (await storedNotes(page)).find((note) => (note.lines?.[0] ?? "").trim() === title);

  await pictureToClipboard(page, picture);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+V");
  step(
    "a picture on the computer's clipboard pastes into a note as a picture",
    await seen(async () => (await editor.locator("img").count()) === 1),
  );

  const PDF = `Report ${id}.pdf`;
  const made = await upload(
    page,
    "documents",
    PDF,
    "application/pdf",
    Buffer.from("%PDF-1.4\n%%EOF\n").toString("base64"),
  );
  step("a PDF stands on the drive", made.status === 200, JSON.stringify(made));
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = finder.getByRole("option", { name: PDF, exact: true }).first();
  await file.waitFor({ timeout: 10_000 });
  const before = await finder.boundingBox();
  await page.mouse.move(before.x + 300, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 300 + (900 - before.x), before.y + 10, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const box = await file.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 4 });
  const target = await editor.boundingBox();
  await page.mouse.move(target.x + 120, target.y + 60, { steps: 12 });
  await page.mouse.up();
  const block = editor.locator("[data-file-id]").filter({ hasText: PDF });
  step(
    "a PDF dropped from Finder stands in the note as an attachment",
    await seen(async () => (await block.count()) === 1),
    (await editor.innerText()).slice(0, 120),
  );
  await shot(page, "b7-notes");
  const onServerHolds = async () => JSON.stringify((await stored()) ?? {}).includes(PDF);
  step("and the note on the server holds it", await seen(onServerHolds, 12_000));
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  step("and still does after a reload", await seen(onServerHolds));
}

async function stickies(page) {
  await openFromDock(page, "Stickies", undefined).catch(() => {});
  const note = page.locator(".mac-stickies-note").first();
  await note.waitFor({ timeout: 15_000 });
  const text = note.locator(".mac-stickies-note-text");
  await text.click();
  const mark = `Zoom ${id}`;
  await page.keyboard.insertText(`${mark}\n${"line\n".repeat(30)}`);
  await page.waitForTimeout(800);
  const zoomRow = async () => {
    await page
      .getByRole("menubar")
      .getByRole("menuitem", { name: "Window", exact: true })
      .first()
      .click();
    await page
      .getByRole("menu")
      .last()
      .getByRole("menuitem", { name: "Zoom", exact: true })
      .click();
    await page.waitForTimeout(500);
  };
  const height = async () => (await note.boundingBox()).height;
  const stored = async () =>
    (await storedStickies(page)).find((each) => (each.text ?? JSON.stringify(each)).includes(mark));
  const before = await height();
  await zoomRow();
  const fitted = await height();
  const scroll = await text.evaluate((field) => field.scrollHeight - field.clientHeight);
  step(
    "Window > Zoom makes the note as tall as its text",
    fitted > before + 100 && scroll <= 2,
    `${before} to ${fitted}, ${scroll} over`,
  );
  step(
    "the fitted frame is kept on the server",
    await seen(async () => Math.abs(((await stored())?.frame?.height ?? 0) - fitted) < 3, 8_000),
    JSON.stringify((await stored())?.frame),
  );
  await zoomRow();
  step(
    "Zoom again goes back to the size it had",
    await seen(async () => Math.abs((await height()) - before) < 3, 3_000),
    `${await height()}`,
  );
  await zoomRow();
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: "load" });
  await text.evaluate((field) => {
    const range = document.createRange();
    range.selectNodeContents(field.firstChild ?? field);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.getByRole("menubar").getByRole("menuitem", { name: "Stickies", exact: true }).click();
  await page.getByRole("menuitem", { name: "Services" }).hover();
  const service = (name) => page.getByRole("menuitem", { name, exact: true });
  step(
    "Services lists Look Up, Search the Web and what the other apps take",
    await seen(
      async () =>
        (await service("Look Up in Dictionary").count()) +
          (await service("Search the Web").count()) >=
          1 && (await service("Make New Sticky Note").count()) === 1,
      5_000,
    ),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}

async function vCardEncoding(page) {
  await openFromDock(page, "Contacts").catch(() => {});
  const windowC = page.locator('.mac-contacts[aria-label="Contacts"]').first();
  await windowC.getByRole("listbox").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  const first = `Åsa${id}`;
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
  await chooser.setFiles({
    name: "card.vcf",
    mimeType: "text/vcard",
    buffer: Buffer.from(
      `BEGIN:VCARD\r\nVERSION:3.0\r\nN:Aaland;${first};;;\r\nFN:${first} Aaland\r\nNOTE:Köper €5\r\nEND:VCARD\r\n`,
    ),
  });
  const told = page.getByRole("alertdialog").last();
  await told.waitFor({ timeout: 10_000 });
  await told.getByRole("button").last().click();
  await page.waitForTimeout(800);
  const row = windowC.getByRole("listbox").getByRole("option").filter({ hasText: first }).first();
  await row.waitFor({ timeout: 10_000 });
  const choose = async () => {
    await seen(async () => (await row.getAttribute("aria-selected")) === "true", 2_000);
    if ((await row.getAttribute("aria-selected")) !== "true") await row.click();
  };
  await choose();

  const pick = async (label, option) => {
    await page.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: option }).last().click();
    await page.waitForTimeout(800);
  };
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Contacts", exact: true })
    .first()
    .click();
  await page
    .getByRole("menu")
    .last()
    .getByRole("menuitem", { name: /^Preferences/ })
    .click();
  await page.getByRole("tab", { name: "vCard" }).click();
  const encoding = page.getByRole("combobox", { name: "vCard Encoding" });
  step(
    "vCard Encoding is dimmed under 3.0, saying why",
    (await encoding.isDisabled()) &&
      /always UTF-8/.test((await encoding.getAttribute("title")) ?? ""),
  );
  await pick("vCard Format", "2.1");
  await pick("vCard Encoding", /Outlook/);
  step(
    "Windows Latin 1 is kept on the server",
    await seen(async () => (await values(page))["contacts.vcardEncoding"] === "windows-1252"),
  );
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
    "an export writes Windows Latin 1: Å as =C5, € as =80",
    /CHARSET=WINDOWS-1252:[^\r]*=C5sa/.test(text.replace(/=\r\n/g, "")) &&
      text
        .replace(/=\r\n/g, "")
        .includes("NOTE;ENCODING=QUOTED-PRINTABLE;CHARSET=WINDOWS-1252:K=F6per =805"),
    text.split("\r\n").slice(0, 5).join(" | "),
  );
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  step(
    "and the choice is still on the server after a reload",
    (await values(page))["contacts.vcardEncoding"] === "windows-1252",
  );
}

async function anHourLong(page) {
  const ONE_HOUR = 57_600_000;
  const started = Date.now();
  const made = await upload(page, "music", `An hour ${id}.webm`, "audio/webm", null, ONE_HOUR);
  const entry = (await driveEntries(page)).find((each) => each.name === `An hour ${id}.webm`);
  step(
    "what a take of an hour weighs, 128 kbit/s for 3600 s, goes up through the drive's route",
    made.status === 200 && entry?.size === ONE_HOUR,
    `${made.pieces} pieces in ${(Date.now() - started) / 1000} s, ${entry?.size} bytes on the server`,
  );
  await page.evaluate(
    async (id) =>
      fetch("/api/files/ops", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops: [{ op: "trash", id }] }),
      }),
    entry?.id,
  );

  const held = await page.evaluate(() =>
    fetch("/api/app-store/library", { credentials: "same-origin" }).then((reply) => reply.json()),
  );
  await page.evaluate(
    (body) =>
      fetch("/api/app-store/library", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    {
      installed: [
        ...(held.installed ?? []).filter((each) => each !== "voice-memos"),
        "voice-memos",
      ],
      rev: held.rev,
    },
  );
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Voice Memos");
  await field.press("Enter");
  const win = page.locator('.mac-managed-window[data-window-id="voice-memos"]').first();
  await win.waitFor({ timeout: 15_000 });
  await win.getByRole("button", { name: "New Recording" }).first().waitFor({ timeout: 15_000 });
  await win.getByRole("button", { name: "New Recording" }).first().click();
  await page.getByRole("button", { name: "Done" }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2_000);
  await page.evaluate(() => {
    window.__skip += 590_000;
  });
  await page.waitForTimeout(1_000);
  step(
    "a take goes on past the ten minutes it used to stop at",
    (await page.getByRole("button", { name: "Done" }).count()) > 0,
  );
  await page.evaluate(() => {
    window.__skip += 2_990_000;
  });
  const frames = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let count = 0;
        const started = Date.now();
        const frame = () => {
          count += 1;
          if (Date.now() - started < 3_000) requestAnimationFrame(frame);
          else resolve(count / 3);
        };
        requestAnimationFrame(frame);
      }),
  );
  step(
    "at 59 minutes the window still draws",
    frames >= 5,
    `${Math.round(frames)} frames a second`,
  );
  await page.evaluate(() => {
    window.__skip += 30_000;
  });
  step(
    "it stops by itself at the hour and says so",
    await seen(
      () => page.getByText("Voice Memos ends a recording at an hour").first().isVisible(),
      15_000,
    ),
  );
  const take = async () =>
    (await driveEntries(page)).find((each) => /^New Recording.*\.(webm|ogg|m4a)$/.test(each.name));
  step(
    "and what was recorded is on the drive",
    await seen(async () => (await take())?.size > 0, 10_000),
    `${(await take())?.name} ${(await take())?.size} bytes`,
  );
}

function recordTones() {
  window.__tones = [];
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function played(...when) {
    window.__tones.push(Math.round(this.frequency.value));
    return start.apply(this, when);
  };
  window.__skip = 0;
  const now = performance.now.bind(performance);
  performance.now = () => now() + window.__skip;
}

await run(
  {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  { chromium: { permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true } },
  async ({ person }) => {
    const a = await person("chris", chris);
    const b = await person("martin", martin);
    for (const page of [a, b]) {
      await page.addInitScript(recordTones);
      await page.reload({ waitUntil: "load" });
      await page
        .getByRole("button", { name: /^Finder$/ })
        .first()
        .waitFor({ timeout: 30_000 });
    }
    await openMail(a);
    await openMail(b);
    const parts = process.argv.includes("--only")
      ? process.argv[process.argv.indexOf("--only") + 1].split(",")
      : ["sounds", "markup", "paste", "tabs", "notes", "stickies", "vcard", "hour"];
    const picture = await whitePicture(a);
    if (parts.includes("sounds")) await sounds(a, b);
    if (parts.includes("markup")) await markup(a, b, picture);
    if (parts.includes("paste")) await pasteInMail(a, b, picture);
    if (parts.includes("tabs")) await twoTabs(a, b);
    if (parts.includes("notes")) await notes(a, picture);
    if (parts.includes("stickies")) await stickies(a);
    if (parts.includes("vcard")) await vCardEncoding(a);
    if (parts.includes("hour")) await anHourLong(a);
  },
);

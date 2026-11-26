#!/usr/bin/env node
// Files from the desktop's own icons into other applications, with real mouse and key input: a drag
// and a Copy then Paste into Mail, Messages and Photos, and a drag into Notes. Mail's files are read
// from the message the other person receives, Messages' from the other person's conversation,
// Photos' from its library on the server. Exits 0 only when every step passed and no page logged a
// console error, a page error, a failed request or an HTTP error.
//
//   node e2e/desktop-into-apps-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                          [--browser chromium|chrome|firefox|webkit]

import { crc32, deflateSync } from "node:zlib";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot, browserName } = twoPeople("desktop-into-apps");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `diachris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `diamartin-${id}`, fullName: `Martin ${id}`, password };
const MAIL_DRAGGED = `mail-drag-${id}.txt`;
const MAIL_PASTED = `mail-paste-${id}.txt`;
const NOTE_DRAGGED = `note-drag-${id}.txt`;
const NOTE_LINE = `a line from the desktop ${id}`;
const CHAT_DRAGGED = `chat-drag-${id}.txt`;
const CHAT_PASTED = `chat-paste-${id}.txt`;
const PHOTO_DRAGGED = `photo-drag-${id}`;
const PHOTO_PASTED = `photo-paste-${id}`;
const subject = `From the desktop ${id}`;

const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const PNG = (() => {
  const size = 64;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2], 8);
  const line = Buffer.concat([
    Buffer.from([0]),
    Buffer.alloc(size * 3, Buffer.from([20, 90, 220])),
  ]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: size }, () => line)))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
})();

const getJson = async (page, route) => {
  const reply = await page.request.get(new URL(route, page.url()).href);
  return reply.ok() ? await reply.json() : null;
};

async function chatFiles(page) {
  const names = [];
  const list = await getJson(page, "/api/messages/conversations");
  for (const { id: conversation } of list?.conversations ?? []) {
    const state = await getJson(page, `/api/messages/conversations/${conversation}`);
    for (const message of state?.state?.messages ?? []) {
      for (const each of message.attachments ?? []) names.push(each.name);
    }
  }
  return names;
}

const photoNames = async (page) =>
  ((await getJson(page, "/api/photos/library"))?.photos ?? []).map((photo) => photo.name);

await run({}, {}, async ({ person }) => {
  const other = await person("martin", martin);
  const page = await person("chris", chris);
  for (const name of [MAIL_DRAGGED, MAIL_PASTED, CHAT_DRAGGED, CHAT_PASTED]) {
    await uploadFile(page, { parent: "desktop", name, type: "text/plain", text: name });
  }
  await uploadFile(page, {
    parent: "desktop",
    name: NOTE_DRAGGED,
    type: "text/plain",
    text: NOTE_LINE,
  });
  for (const name of [PHOTO_DRAGGED, PHOTO_PASTED]) {
    await uploadFile(page, {
      parent: "desktop",
      name: `${name}.png`,
      type: "image/png",
      bytes: PNG,
    });
  }
  // A wide page leaves the icons at the right of the screen clear of the windows.
  await page.setViewportSize({ width: 2300, height: 1000 });
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });

  const desk = page.getByRole("group", { name: "Desktop", exact: true });
  const icon = (name) => desk.locator(".mac-desktop-icon", { hasText: name }).first();
  await icon(MAIL_DRAGGED).waitFor({ timeout: 15_000 });

  /** Drags a desktop icon to the middle of `target`, or `offset` inside it. */
  async function drag(name, target, offset) {
    const from = await icon(name).boundingBox();
    const box = await target.boundingBox();
    if (!from || !box) throw new Error(`${name} or the place to drop it is not shown`);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 12, from.y + from.height / 2 + 12, {
      steps: 4,
    });
    await page.mouse.move(
      box.x + (offset?.x ?? box.width / 2),
      box.y + (offset?.y ?? box.height / 2),
      { steps: 12 },
    );
    await page.mouse.up();
  }
  /** Copy on the desktop: the icon is selected and takes the key. */
  async function copy(name) {
    await icon(name).click();
    await page.keyboard.press("Control+C");
  }

  // Mail.
  await openFromDock(page, "Mail", undefined).catch(() => {});
  const viewer = page.locator(".mac-mail").first();
  await within(15_000, () => viewer.isVisible());
  await viewer.getByRole("button", { name: "New Message" }).click();
  const compose = page.locator(".mac-mail-compose").first();
  const strip = compose.getByRole("list", { name: "Attachments" });
  const attached = (name) =>
    strip.getByRole("listitem").filter({ hasText: name }).filter({ hasText: "byte" });
  const to = compose.getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await compose.getByLabel("Subject:").fill(subject);
  await drag(MAIL_DRAGGED, compose.getByRole("textbox", { name: "Message" }));
  step(
    "A desktop icon dragged onto a New Message is attached",
    (await within(15_000, () => attached(MAIL_DRAGGED).isVisible())) !== null,
  );
  await copy(MAIL_PASTED);
  await compose.getByRole("textbox", { name: "Message" }).click();
  await page.keyboard.press("Control+V");
  step(
    "A desktop icon copied and pasted into a New Message is attached",
    (await within(15_000, () => attached(MAIL_PASTED).isVisible())) !== null,
  );
  await shot(page, "desktop-into-mail");
  await compose.getByRole("button", { name: "Send" }).click();
  const received = async () => {
    const { messages = [] } = (await getJson(other, "/api/mail/messages")) ?? {};
    return messages.find((message) => message.subject === subject)?.attachments ?? [];
  };
  await within(20_000, async () => (await received()).length === 2);
  const files = (await received()).map((each) => each.name);
  step(
    "and the other person receives both files",
    files.includes(MAIL_DRAGGED) && files.includes(MAIL_PASTED),
    files.join(", "),
  );

  // Notes.
  await openFromDock(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 10_000 });
  await notes.getByRole("button", { name: "New Note" }).click();
  await page.keyboard.type(`Drop target ${id}`);
  const editor = notes.locator('[aria-label="Note"]:visible');
  await drag(NOTE_DRAGGED, editor);
  step(
    "A text file dragged from the desktop adds its lines to the note",
    (await within(10_000, async () => (await editor.innerText()).includes(NOTE_LINE))) !== null,
  );

  // Messages.
  await openFromDock(page, "Messages");
  const messages = page.locator('.mac-messages[aria-label="Messages"]').first();
  await messages.getByRole("button", { name: "Compose new message" }).click();
  await messages.getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = messages.getByRole("textbox", { name: "Message" });
  await field.fill(`hello ${id}`);
  await field.press("Enter");
  await within(20_000, async () => {
    const list = await getJson(other, "/api/messages/conversations");
    return (list?.conversations?.length ?? 0) > 0;
  });
  await page.waitForTimeout(500);
  await drag(CHAT_DRAGGED, messages.locator(".mac-messages-pane"), { x: 300, y: 60 });
  step(
    "A desktop icon dragged onto a conversation reaches the other person",
    (await within(20_000, async () => (await chatFiles(other)).includes(CHAT_DRAGGED))) !== null,
  );
  await copy(CHAT_PASTED);
  await field.click();
  await page.keyboard.press("Control+V");
  step(
    "A desktop icon copied and pasted into a conversation reaches the other person",
    (await within(20_000, async () => (await chatFiles(other)).includes(CHAT_PASTED))) !== null,
  );
  step(
    "Pasting a file leaves no words in the message field",
    (await field.inputValue()) === "",
    await field.inputValue(),
  );
  await shot(page, "desktop-into-messages");

  // Reminders: a picture onto a reminder's row.
  await openFromDock(page, "Reminders");
  const reminders = page.locator('.mac-reminders[aria-label="Reminders"]').first();
  await reminders.getByRole("button", { name: "New Reminder" }).click();
  const reminderTitle = reminders.getByRole("textbox", { name: "Title" });
  await reminderTitle.fill(`Picture ${PHOTO_DRAGGED}`);
  await reminderTitle.press("Enter");
  const reminderRow = reminders
    .locator("[data-index]")
    .filter({ hasText: `Picture ${PHOTO_DRAGGED}` })
    .first();
  await reminderRow.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(600);
  await drag(`${PHOTO_DRAGGED}.png`, reminderRow);
  step(
    "A picture dragged from the desktop onto a reminder goes on that reminder",
    (await within(15_000, async () => (await reminderRow.locator("img").count()) > 0)) !== null,
  );

  // Photos.
  await openFromDock(page, "Photos");
  const photos = page.locator(".mac-window:has(.mac-photos-body)").first();
  await photos.waitFor({ timeout: 10_000 });
  await within(15_000, async () => !(await photos.getAttribute("aria-busy")));
  await drag(`${PHOTO_DRAGGED}.png`, photos.locator(".mac-photos-body"));
  step(
    "A picture dragged from the desktop into Photos is in the library",
    (await within(20_000, async () => (await photoNames(page)).includes(PHOTO_DRAGGED))) !== null,
    (await photoNames(page)).join(", "),
  );
  // Chromium alone lets a page put a picture on the computer's clipboard: an older copy, made
  // outside the desktop, which the copy on the desktop comes after.
  if (browserName === "chromium") {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const image = new Blob([bytes], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
    }, PNG.toString("base64"));
    const search = photos.locator("input[placeholder='Search']").first();
    await search.click();
    await page.keyboard.press("Control+V");
    await page.waitForTimeout(1_500);
    step(
      "A picture pasted into Photos' search field does not reach the library",
      (await photoNames(page)).length === 1,
      (await photoNames(page)).join(", "),
    );
    const WORDS = `pasted words ${id}`;
    await page.evaluate((text) => navigator.clipboard.writeText(text), WORDS);
    await page.keyboard.press("Control+V");
    step(
      "and text pasted there goes in the field",
      (await within(5_000, async () => (await search.inputValue()) === WORDS)) !== null,
      await search.inputValue(),
    );
    await search.fill("");
    await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const image = new Blob([bytes], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
    }, PNG.toString("base64"));
  }
  await copy(`${PHOTO_PASTED}.png`);
  await photos.locator(".mac-photos-body").click({ position: { x: 300, y: 20 } });
  await page.keyboard.press("Control+V");
  step(
    "A picture copied on the desktop and pasted into Photos is in the library",
    (await within(20_000, async () => (await photoNames(page)).includes(PHOTO_PASTED))) !== null,
    (await photoNames(page)).join(", "),
  );
  await page.waitForTimeout(1_500);
  step(
    "and only that one: an older picture on the computer's clipboard stays out",
    (await photoNames(page)).length === 2,
    (await photoNames(page)).join(", "),
  );
  await page.waitForTimeout(400);
  await shot(page, "desktop-into-photos");
});

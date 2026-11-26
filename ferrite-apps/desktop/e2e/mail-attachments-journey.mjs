#!/usr/bin/env node
// Mail's attachments, on Ferrite, in a real browser against the running app: a file from the drive
// through the Open panel, a file from the computer, a file dragged from Finder with real mouse
// input, one removed, the message sent; the recipient sees the mark in the list and the picture in
// the message, reads the same bytes back and saves it to Downloads on the drive; and a draft keeps
// its file until it is opened and sent. Exits 0 only when every step passed and no page logged a
// console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/mail-attachments-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                         [--browser chromium|chrome|firefox|webkit]

import { crc32, deflateSync } from "node:zlib";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot } = twoPeople("mail-attachments");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `machris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mamartin-${id}`, fullName: `Martin ${id}`, password };
const subject = `Harbor ${id}`;
const drafted = `Later ${id}`;
const FROM_DRIVE = `plan-${id}.txt`;
const DRAGGED = `chart-${id}.txt`;
const LATER = `later-${id}.txt`;
const PICTURE = `harbor-${id}.png`;
const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
/** A 64 by 64 picture of one blue. */
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

const viewer = (page) => page.locator(".mac-mail").first();
const compose = (page) => page.locator(".mac-mail-compose").first();
const strip = (page) => compose(page).getByRole("list", { name: "Attachments" });
const rows = (page) => viewer(page).getByRole("listbox", { name: "Messages" }).getByRole("option");
const row = (page, text) => rows(page).filter({ hasText: text }).first();
const received = (page) => viewer(page).getByRole("list", { name: "Attachments" });
const computerInput = (page) => compose(page).getByLabel("Files from this computer");
const listedAndUploaded = (page, name) =>
  strip(page).getByRole("listitem").filter({ hasText: name }).filter({ hasText: "byte" });

const messages = async (page) => {
  const reply = await page.request.get(new URL("/api/mail/messages", page.url()).href);
  return (await reply.json()).messages ?? [];
};
const stored = (page, check) => within(12_000, async () => check(await messages(page)));

async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag from or to is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await uploadFile(a, {
    parent: "documents",
    name: FROM_DRIVE,
    type: "text/plain",
    text: "the plan",
  });
  await uploadFile(a, {
    parent: "documents",
    name: DRAGGED,
    type: "text/plain",
    text: "the chart",
  });
  await uploadFile(a, { parent: "documents", name: LATER, type: "text/plain", text: "for later" });
  // Files made outside the page: it reads the drive afresh.
  await a.reload({ waitUntil: "load" });
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });

  await openFromDock(a, "Mail", undefined).catch(() => {});
  await within(15_000, () => viewer(a).isVisible());
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  const to = compose(a).getByLabel("To:");
  await to.click();
  await to.pressSequentially(martin.name);
  await to.press("Enter");
  await compose(a).getByLabel("Subject:").fill(subject);

  // From the drive, through the Open panel of File > Attach Files' key.
  await a.keyboard.press("Control+Shift+A");
  const panel = a.locator(".mac-mail-panel-layer");
  await panel.waitFor({ timeout: 5_000 });
  await panel.getByText(FROM_DRIVE, { exact: true }).first().waitFor({ timeout: 30_000 });
  await shot(a, "mail-attach-panel");
  await panel.getByText(FROM_DRIVE, { exact: true }).first().dblclick();
  step(
    "Shift-Command-A opens the Open panel, and a file of the drive is attached",
    (await within(10_000, () => listedAndUploaded(a, FROM_DRIVE).isVisible())) !== null,
  );

  // From the computer.
  await computerInput(a).setInputFiles({ name: PICTURE, mimeType: "image/png", buffer: PNG });
  step(
    "a file from the computer is attached",
    (await within(10_000, () => listedAndUploaded(a, PICTURE).isVisible())) !== null,
  );

  // From Finder, with the mouse: Finder is moved clear of the window first.
  await a.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = a.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = finder.getByRole("option", { name: DRAGGED, exact: true }).first();
  await file.waitFor({ timeout: 10_000 });
  const bar = await finder.boundingBox();
  await a.mouse.move(bar.x + bar.width / 2, bar.y + 12);
  await a.mouse.down();
  await a.mouse.move(bar.x + bar.width / 2, bar.y + 300, { steps: 12 });
  await a.mouse.up();
  const from = await centre(file);
  const target = await compose(a).boundingBox();
  await a.mouse.move(from.x, from.y);
  await a.mouse.down();
  await a.mouse.move(from.x + 10, from.y + 10, { steps: 4 });
  await a.mouse.move(target.x + target.width - 40, target.y + 120, { steps: 12 });
  await a.mouse.up();
  // The window comes to the front again, over Finder.
  await compose(a).click({ position: { x: 300, y: 12 } });
  step(
    "a file dragged from Finder is attached",
    (await within(10_000, () => listedAndUploaded(a, DRAGGED).isVisible())) !== null,
  );
  await shot(a, "mail-attach-strip");

  // One taken away, and the rest go.
  await listedAndUploaded(a, FROM_DRIVE).getByRole("button", { name: "Remove" }).click();
  step("Remove takes a file away", (await strip(a).getByRole("listitem").count()) === 2);
  await a.keyboard.press("Control+Shift+D");
  const gone = await within(15_000, async () => (await compose(a).count()) === 0);
  step("the message goes with its files", gone !== null);
  const sentCopy = (await messages(a)).find((m) => m.mailbox === "sent" && m.subject === subject);
  step(
    "the Sent copy names exactly those two",
    (sentCopy?.attachments ?? [])
      .map((f) => f.name)
      .sort()
      .join() === [DRAGGED, PICTURE].sort().join(),
  );

  // The recipient.
  await openFromDock(b, "Mail", undefined).catch(() => {});
  await within(20_000, async () => {
    await b.keyboard.press("Control+Shift+N");
    return (await rows(b).count()) === 1;
  });
  step(
    "the message list marks a message with files",
    await row(b, subject).getByRole("img", { name: "2 attachments" }).isVisible(),
  );
  await row(b, subject).click();
  const picture = received(b).getByRole("img", { name: PICTURE });
  step(
    "the message shows the picture at its own size",
    (await within(10_000, async () =>
      picture.evaluate((img) => img.complete && img.naturalWidth === 64 && img.width === 64),
    )) !== null,
  );
  await shot(b, "mail-attachment-received");
  const [message] = await messages(b);
  const attachment = message.attachments.find((f) => f.name === PICTURE);
  const bytes = await b.request.get(
    new URL(`/api/mail/messages/${message.id}/attachments/${attachment.id}`, b.url()).href,
  );
  step("its bytes read back unchanged", Buffer.compare(await bytes.body(), PNG) === 0);
  await received(b)
    .getByRole("listitem")
    .filter({ hasText: DRAGGED })
    .getByRole("button", { name: "Save to Downloads" })
    .click();
  step(
    "Save to Downloads puts the file on the recipient's drive",
    (await within(10_000, async () => {
      const reply = await b.request.get(new URL("/api/files/", b.url()).href);
      return ((await reply.json()).entries ?? []).some((e) => e.name === DRAGGED);
    })) !== null,
  );
  const [download] = await Promise.all([
    b.waitForEvent("download", { timeout: 10_000 }),
    received(b)
      .getByRole("listitem")
      .filter({ hasText: DRAGGED })
      .getByRole("button", { name: "Download", exact: true })
      .click(),
  ]);
  step("Download hands the file to the browser", download.suggestedFilename() === DRAGGED);

  // A draft keeps its file; closing while the file is on its way waits for it.
  await viewer(a).getByRole("button", { name: "New Message" }).click();
  await compose(a).getByLabel("Subject:").fill(drafted);
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await a.route("**/api/mail/attachments/*/complete", async (route) => {
    await held;
    await route.continue();
  });
  await computerInput(a).setInputFiles({
    name: LATER,
    mimeType: "text/plain",
    buffer: Buffer.from("for later"),
  });
  const close = compose(a).getByRole("button", { name: "Close" }).first();
  await strip(a).getByText(LATER).waitFor({ timeout: 5_000 });
  await close.click();
  step(
    "closing while a file is uploading keeps the window open and says why",
    (await within(5_000, () =>
      compose(a).getByRole("alert").getByText("finished uploading").isVisible(),
    )) !== null && (await compose(a).count()) === 1,
  );
  release();
  await within(10_000, () => listedAndUploaded(a, LATER).isVisible());
  await a.unroute("**/api/mail/attachments/*/complete");
  await close.click();
  await within(10_000, async () => (await compose(a).count()) === 0);
  step(
    "closing a message keeps its file with the draft",
    (await stored(a, (all) =>
      all.some((m) => m.mailbox === "drafts" && m.attachments?.[0]?.name === LATER),
    )) !== null,
  );
  await viewer(a)
    .getByRole("radio", { name: /^Drafts/ })
    .click();
  await row(a, drafted).dblclick();
  await compose(a).waitFor({ timeout: 10_000 });
  step(
    "the draft opens with its file",
    (await within(10_000, () => listedAndUploaded(a, LATER).isVisible())) !== null,
  );
  const again = compose(a).getByLabel("To:");
  await again.click();
  await again.pressSequentially(martin.name);
  await again.press("Enter");
  await a.keyboard.press("Control+Shift+D");
  await within(15_000, async () => (await compose(a).count()) === 0);
  step(
    "sent, the recipient has the file",
    (await stored(b, (all) =>
      all.some((m) => m.subject === drafted && m.attachments?.[0]?.name === LATER),
    )) !== null,
  );

  // Finder's Share menu puts the file into a New Message.
  await a.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await finder.getByRole("option", { name: FROM_DRIVE, exact: true }).first().click();
  await finder.getByRole("button", { name: "Share" }).click();
  await a.getByRole("menu").last().getByRole("menuitem", { name: "Mail" }).click();
  step(
    "Share > Mail in Finder opens a New Message holding the file",
    (await within(10_000, () => listedAndUploaded(a, FROM_DRIVE).isVisible())) !== null,
  );
  await shot(a, "mail-share-from-finder");
});

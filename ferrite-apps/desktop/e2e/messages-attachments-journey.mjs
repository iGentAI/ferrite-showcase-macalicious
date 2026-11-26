#!/usr/bin/env node
// Files in Messages on Ferrite, in a real browser against the running app: a file from the computer
// and one dragged from Finder, each a message of its own; the other person sees the picture, reads the
// same bytes and saves a file to Downloads; someone outside the conversation cannot read it. Exits 0
// only when every step passed and no page logged a console error, a page error, a failed request or
// an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/messages-attachments-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                             [--browser chromium|chrome|firefox|webkit]

import { crc32, deflateSync } from "node:zlib";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { step, run, shot } = twoPeople("messages-attachments");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `mtchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `mtmartin-${id}`, fullName: `Martin ${id}`, password };
const ann = { name: `mtann-${id}`, fullName: `Ann ${id}`, password };
const PICTURE = `harbor-${id}.png`;
const DRAGGED = `chart-${id}.txt`;

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

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();
const transcript = (page) => messagesOf(page).getByRole("log").first();
const rowOf = (page, name) =>
  messagesOf(page)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: name })
    .first();
const api = async (page, path) => {
  const reply = await page.request.get(new URL(`/api/messages${path}`, page.url()).href);
  return {
    status: reply.status(),
    json: reply.ok() ? await reply.json().catch(() => null) : null,
    reply,
  };
};

async function centre(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag from or to is not shown");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

await run({}, {}, async ({ person: open }) => {
  const pageA = await open("ann", ann);
  const pageM = await open("martin", martin);
  const page = await open("chris", chris);
  await uploadFile(page, {
    parent: "documents",
    name: DRAGGED,
    type: "text/plain",
    text: "the chart",
  });
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await openFromDock(pageM, "Messages");
  await openFromDock(page, "Messages");

  await messagesOf(page).getByRole("button", { name: "Compose new message" }).click();
  await messagesOf(page).getByRole("textbox", { name: "To" }).fill(martin.name);
  const field = messagesOf(page).getByRole("textbox", { name: "Message" });
  await field.fill(`hello ${id}`);
  await field.press("Enter");
  await within(20_000, () => rowOf(page, martin.fullName).isVisible());

  // From the computer.
  await messagesOf(page)
    .getByLabel("Send files from this computer")
    .setInputFiles({ name: PICTURE, mimeType: "image/png", buffer: PNG });
  const attachments = (where) => transcript(where).getByRole("list", { name: "Attachments" });
  step(
    "a file from the computer is sent as a message",
    (await within(15_000, () =>
      attachments(page).getByRole("listitem").filter({ hasText: PICTURE }).first().isVisible(),
    )) !== null,
  );

  // From Finder, with the mouse; Finder is moved down, clear of Messages' pane.
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = finder.getByRole("option", { name: DRAGGED, exact: true }).first();
  await file.waitFor({ timeout: 10_000 });
  const bar = await finder.boundingBox();
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 12);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 340, { steps: 12 });
  await page.mouse.up();
  const from = await centre(file);
  const pane = await messagesOf(page).locator(".mac-messages-pane").boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 4 });
  await page.mouse.move(pane.x + pane.width / 2, pane.y + 30, { steps: 12 });
  await page.mouse.up();
  await messagesOf(page).locator(".mac-messages-header").click();
  step(
    "a file dragged from Finder is sent as a message",
    (await within(15_000, () =>
      attachments(page).getByRole("listitem").filter({ hasText: DRAGGED }).first().isVisible(),
    )) !== null,
  );
  await shot(page, "messages-attachments-sent");

  // The other person.
  await within(20_000, async () => {
    const row = rowOf(pageM, chris.fullName);
    if (await row.isVisible()) await row.click();
    return transcript(pageM).getByText(`hello ${id}`).first().isVisible();
  });
  const picture = attachments(pageM).getByRole("img", { name: PICTURE });
  step(
    "the other person sees the picture",
    (await within(15_000, () =>
      picture.evaluate((img) => img.complete && img.naturalWidth === 64),
    )) !== null,
  );
  await shot(pageM, "messages-attachments-received");
  const { json: conversations } = await api(pageM, "/conversations");
  const conversation = conversations.conversations[0].id;
  const { json: state } = await api(pageM, `/conversations/${conversation}`);
  const carried = state.state.messages.flatMap((m) => m.attachments ?? []);
  const png = carried.find((each) => each.name === PICTURE);
  const url = `/conversations/${conversation}/attachments/${png.id}`;
  const read = await api(pageM, url);
  step("its bytes read back unchanged", Buffer.compare(await read.reply.body(), PNG) === 0);
  const peek = await api(pageA, url);
  step("someone outside the conversation cannot read it", peek.status === 404, String(peek.status));

  await attachments(pageM)
    .getByRole("listitem")
    .filter({ hasText: DRAGGED })
    .getByRole("button", { name: "Save to Downloads" })
    .click();
  step(
    "Save to Downloads puts the file on the other person's drive",
    (await within(10_000, async () => {
      const reply = await pageM.request.get(new URL("/api/files/", pageM.url()).href);
      return ((await reply.json()).entries ?? []).some((e) => e.name === DRAGGED);
    })) !== null,
  );
});

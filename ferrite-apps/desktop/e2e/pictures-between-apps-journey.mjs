#!/usr/bin/env node
// Pictures between applications: copied in Photos with the key, pasted into a note and into a new Mail message, and
// Share in Photos handing one to Notes.
//
//   node e2e/pictures-between-apps-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { api, journey, launch, options, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("pictures-between-apps");
const tag = Date.now().toString(36);
const PICTURE = `Bay ${tag}.png`;

const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), body.length + 4);
  return chunk;
};
const PNG = (() => {
  const size = 48;
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

async function until(check, ms = 12_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** The notes a stored notes document holds: every object in it with `lines`. */
const notesIn = (value, found = []) => {
  if (Array.isArray(value)) for (const item of value) notesIn(item, found);
  else if (value && typeof value === "object") {
    if (Array.isArray(value.lines)) found.push(value);
    else for (const item of Object.values(value)) notesIn(item, found);
  }
  return found;
};

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: `pba${browserName.slice(0, 2)}${tag}`,
    fullName: "Pictures",
    password: randomBytes(12).toString("base64url"),
  });
  await launch(page, "Photos");
  const photos = page.getByRole("region", { name: "Photos", exact: true }).first();
  await photos.waitFor({ timeout: 15_000 });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    photos.getByRole("button", { name: "Import", exact: true }).click(),
  ]);
  await chooser.setFiles({ name: PICTURE, mimeType: "image/png", buffer: PNG });
  const tile = photos.locator("[data-photo-id]").first();
  await tile.waitFor({ timeout: 20_000 });
  await tile.click();
  await page.keyboard.press("Control+C");

  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 10_000 });
  await notes.getByRole("button", { name: "New Note" }).click();
  await page.keyboard.type(`Bay ${tag} `);
  const editor = notes.locator('[aria-label="Note"]:visible');
  await page.keyboard.press("Control+V");
  step(
    "A photo copied in Photos pastes into a note as a picture",
    await until(async () => (await editor.locator("img").count()) > 0),
  );
  await shot(page, path.join(out, `picture-in-note-${browserName}.png`));

  await launch(page, "Mail");
  const mail = page.locator(".mac-mail").first();
  await mail.waitFor({ timeout: 15_000 });
  await mail.getByRole("button", { name: "New Message" }).click();
  const compose = page.locator(".mac-mail-compose").first();
  await compose.waitFor({ timeout: 10_000 });
  await compose.getByRole("textbox", { name: "Message" }).click();
  await page.keyboard.press("Control+V");
  const strip = compose.getByRole("list", { name: "Attachments" });
  step(
    "and into a new message as an attachment",
    await until(
      async () => (await strip.count()) > 0 && (await strip.innerText()).includes(PICTURE),
    ),
  );
  await shot(page, path.join(out, `picture-in-mail-${browserName}.png`));

  const stored = async () => notesIn((await api(page, "GET", "/api/notes/data")).json);
  const earlier = new Set((await stored()).map((note) => note.id));
  await launch(page, "Photos");
  await photos.waitFor({ timeout: 15_000 });
  await tile.click();
  await photos.getByRole("button", { name: "Share" }).first().click();
  await page.getByRole("menuitem", { name: "Notes", exact: true }).first().click();
  await notes.waitFor({ timeout: 10_000 });
  const made = await until(async () =>
    (await stored()).find((note) => !earlier.has(note.id) && note.picture),
  );
  step("Share in Photos makes a new note holding the picture, kept on the server", Boolean(made));
});

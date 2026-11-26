#!/usr/bin/env node

// The shared pieces between apps that nothing drove: Quick Look's Share rows, Share > Add to Photos, a copied file
// pasted into a note by Edit > Paste from the menu bar, Share from Preview, and Extensions' Share Menu choosing the
// rows. Each is read back from the server.
//
//   node e2e/cross-app-more-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { api, journey, options, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("cross-app-more");
const tag = Date.now().toString(36);
const TEXT = `Shared ${tag}.txt`;
const WORDS = `words shared ${tag}`;
const PASTED = `Pasted ${tag}.txt`;
const PASTED_WORDS = `words pasted ${tag}`;
const PICTURE = `Picture ${tag}`;
const SETTINGS = "/api/system-preferences/settings";

const pngChunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), body.length + 4);
  return chunk;
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

async function until(check, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  // An account of its own: a Guest User cannot keep attachments.
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: `crossapp${tag}`,
    fullName: "Cross App",
    password: randomBytes(12).toString("base64url"),
  });
  const shareMenuThen = (await api(page, "GET", SETTINGS)).json.values?.["extensions.shareMenu"];
  try {
    await uploadFile(page, { parent: "documents", name: TEXT, type: "text/plain", text: WORDS });
    await uploadFile(page, {
      parent: "documents",
      name: PASTED,
      type: "text/plain",
      text: PASTED_WORDS,
    });
    await uploadFile(page, {
      parent: "documents",
      name: `${PICTURE}.png`,
      type: "image/png",
      bytes: PNG,
    });
    const dock = page.getByRole("toolbar", { name: "Dock" });
    const finder = page.locator(".mac-window.mac-finder").first();
    const toFinder = async () => {
      await dock.getByRole("button", { name: "Finder", exact: true }).click();
      await finder.waitFor({ timeout: 10_000 });
      await finder.getByRole("treeitem", { name: "Documents", exact: true }).click();
    };
    const item = (name) => finder.getByRole("option", { name, exact: true }).first();
    const noteHolds = async (words) =>
      JSON.stringify((await api(page, "GET", "/api/notes/data")).json).includes(words);
    const look = page.locator(".mac-quick-look-panel").first();
    const openLook = async (name) => {
      await toFinder();
      await item(name).click();
      await page.keyboard.press("Space");
      await look.waitFor({ timeout: 8_000 });
    };
    const closeLook = async () => {
      if (await look.isVisible().catch(() => false)) {
        await look.getByRole("button", { name: "Close" }).first().click();
      }
    };

    // Quick Look's Share rows.
    await openLook(TEXT);
    await look.getByRole("button", { name: "Share" }).click();
    await shot(page, path.join(out, `cross-quick-look-share-${browserName}.png`));
    step(
      "Quick Look's Share lists the file rows",
      (await page.getByRole("menuitem", { name: "Mail", exact: true }).count()) === 1 &&
        (await page.getByRole("menuitem", { name: "Messages", exact: true }).count()) === 1,
    );
    await page.getByRole("menuitem", { name: "Notes", exact: true }).click();
    step(
      "Share > Notes there makes a note with the file's lines, on the server",
      await until(() => noteHolds(WORDS)),
    );
    await closeLook();

    await openLook(`${PICTURE}.png`);
    await look.getByRole("button", { name: "Share" }).click();
    await page.getByRole("menuitem", { name: "Add to Photos", exact: true }).click();
    step(
      "Share > Add to Photos puts the picture in the library, on the server",
      await until(async () =>
        ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).some(
          (photo) => photo.name === PICTURE,
        ),
      ),
    );
    await shot(page, path.join(out, `cross-add-to-photos-${browserName}.png`));
    await closeLook();

    // Edit > Paste from the menu bar.
    await toFinder();
    await item(PASTED).click();
    await page.keyboard.press("Control+C");
    await dock.getByRole("button", { name: "Notes", exact: true }).click();
    const notes = page.getByRole("region", { name: "Notes" });
    await notes.getByRole("button", { name: "New Note" }).click();
    await page.keyboard.type(`Paste target ${tag}`);
    await page.keyboard.press("Enter");
    const bar = page.getByRole("menubar").first();
    await bar.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.getByRole("menuitem", { name: "Paste", exact: true }).click();
    step(
      "Edit > Paste from the menu bar brings a copied file into the note",
      await until(() => noteHolds(PASTED_WORDS)),
    );
    await page.waitForTimeout(300);
    step(
      "and the menu has closed",
      (await page.getByRole("menuitem", { name: "Paste", exact: true }).count()) === 0,
    );
    await shot(page, path.join(out, `cross-edit-paste-${browserName}.png`));

    // Extensions' Share Menu.
    const prefs = page.locator('[data-window-id="system-preferences"]');
    await dock.getByRole("button", { name: "System Preferences", exact: true }).click();
    await prefs.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    if ((await prefs.getByRole("listbox", { name: "Extension categories" }).count()) === 0) {
      await prefs.getByRole("button", { name: "Extensions", exact: true }).first().click();
    }
    await prefs
      .getByRole("listbox", { name: "Extension categories" })
      .getByRole("option", { name: /^Share Menu/ })
      .click();
    const notesRow = prefs.getByRole("checkbox", { name: "Notes" });
    if (await notesRow.isChecked()) await notesRow.click();
    step(
      "Extensions' Share Menu keeps the choice on the server",
      await until(async () => {
        const on = (await api(page, "GET", SETTINGS)).json.values?.["extensions.shareMenu"];
        return Array.isArray(on) && !on.includes("notes");
      }),
    );
    await shot(page, path.join(out, `cross-extensions-share-${browserName}.png`));
    await prefs.getByRole("button", { name: "Close", exact: true }).first().click();
    await toFinder();
    await item(TEXT).click();
    await finder.getByRole("button", { name: "Share" }).click();
    await page.getByRole("menuitem", { name: "Mail", exact: true }).waitFor({ timeout: 5_000 });
    step(
      "and Notes leaves the Share menu, Mail staying",
      (await page.getByRole("menuitem", { name: "Notes", exact: true }).count()) === 0,
    );
    await shot(page, path.join(out, `cross-share-without-notes-${browserName}.png`));
    await page.keyboard.press("Escape");

    // Preview's Share.
    await item(`${PICTURE}.png`).dblclick();
    const preview = page.locator('[data-window-id^="preview"]').first();
    await preview.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Share", exact: true }).click();
    await page
      .getByRole("menu", { name: "Share" })
      .getByRole("menuitem", { name: "Mail", exact: true })
      .click();
    const compose = page.locator(".mac-mail-compose").first();
    step(
      "Preview's Share > Mail attaches the picture to a new message",
      await until(() =>
        compose
          .getByRole("list", { name: "Attachments" })
          .getByRole("listitem")
          .filter({ hasText: PICTURE })
          .first()
          .isVisible()
          .catch(() => false),
      ),
    );
    await shot(page, path.join(out, `cross-preview-share-${browserName}.png`));
    const composeLevel = await compose.evaluate((element) => {
      const managed = element.closest("[data-window-id]");
      return [managed?.getAttribute("data-window-id"), Number(getComputedStyle(managed).zIndex)];
    });
    const mailLevel = await page
      .locator('[data-window-id="mail"]')
      .evaluate((element) => Number(getComputedStyle(element).zIndex));
    step(
      "and the New Message is in front of Mail's window",
      composeLevel[0] !== "mail" && composeLevel[1] > mailLevel,
      `${composeLevel.join(" at ")}, Mail at ${mailLevel}`,
    );
    const saved = page.waitForResponse(
      (reply) =>
        new URL(reply.url()).pathname === "/api/mail/drafts" &&
        reply.request().method() === "POST" &&
        reply.ok(),
      { timeout: 15_000 },
    );
    await compose.getByRole("button", { name: "Close", exact: true }).first().click();
    await saved;
    const storedDraft = await until(async () => {
      const { json } = await api(page, "GET", "/api/mail/messages");
      for (const message of json.messages ?? []) {
        const attachment = (message.attachments ?? []).find(
          (each) => each.name === `${PICTURE}.png`,
        );
        if (attachment) return { message, attachment };
      }
      return null;
    });
    const bytes =
      storedDraft &&
      (await page.request.get(
        new URL(
          `/api/mail/messages/${storedDraft.message.id}/attachments/${storedDraft.attachment.id}`,
          page.url(),
        ).href,
      ));
    step(
      "and closed, the draft on the server holds the picture's own bytes",
      bytes !== null && Buffer.compare(await bytes.body(), PNG) === 0,
    );
  } finally {
    // Notes goes back in the Share menu as it was found; the app's own save can move the revision first.
    const back = async () =>
      (await api(page, "GET", SETTINGS)).json.values?.["extensions.shareMenu"];
    const same = async () => JSON.stringify(await back()) === JSON.stringify(shareMenuThen);
    await page.waitForTimeout(1_500);
    for (let tries = 0; tries < 4 && !(await same()); tries += 1) {
      const { json } = await api(page, "GET", SETTINGS);
      const values = { ...(json.values ?? {}) };
      if (shareMenuThen === undefined) delete values["extensions.shareMenu"];
      else values["extensions.shareMenu"] = shareMenuThen;
      await api(page, "PUT", SETTINGS, { values, rev: json.rev });
      await page.waitForTimeout(500);
    }
    step("The Share Menu is as it was found", await same(), JSON.stringify(await back()));
  }
});

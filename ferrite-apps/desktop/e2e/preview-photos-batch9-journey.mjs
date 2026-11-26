#!/usr/bin/env node

// Batch nine of Preview and Photos, in a real browser with one real account, reading the server where a thing is stored
// and reloading where it persists:
//   sign:    Create Signature > Camera reads a signature held up to the camera, into the same kept list as the trackpad's.
//            STAND-IN: Chromium's fake camera (--use-file-for-fake-video-capture) plays a Y4M made here of ink on white
//            paper. No lens and no real sheet of paper were involved; the pixels go through the real capture path.
//   copy:    Preview's Edit > Copy of a picture and of its selection puts a PNG on the clipboard, read back; it pastes
//            into Notes, Mail's New Message and Messages.
//   markup:  Mail's Markup moves and resizes a mark and places a signature from Preview's list, read from the pixels of
//            the attachment on the server.
//   edit:    Edit With keeps what Preview saved in the photo's edit on the server, across a reload; Revert takes it away.
//   export:  Photos' Export to a folder of the drive makes its folder and files under one session.
//
//   node e2e/preview-photos-batch9-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--only sign,copy,markup,edit,export]

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { viewer } from "./mail-organize-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

/** A Y4M of 640x480: white paper with a dark wavy line and a stroke across it, in the middle of the picture. */
function signatureVideo() {
  const [width, height] = [640, 480];
  const luma = Buffer.alloc(width * height, 235);
  const ink = (x, y) => {
    if (x >= 0 && y >= 0 && x < width && y < height) luma[y * width + x] = 16;
  };
  for (let x = 120; x < 520; x += 1) {
    const y = Math.round(240 + 28 * Math.sin((x - 120) / 40));
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) ink(x + dx, y + dy);
    }
  }
  const frame = Buffer.concat([
    Buffer.from("FRAME\n"),
    luma,
    Buffer.alloc((width * height) / 2, 128),
  ]);
  const file = path.join(tmpdir(), `signature-${process.pid}.y4m`);
  writeFileSync(
    file,
    Buffer.concat([
      Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420\n`),
      ...Array.from({ length: 10 }, () => frame),
    ]),
  );
  return file;
}

const { step, run, shot } = twoPeople("preview-photos-batch9");
const at = process.argv.indexOf("--only");
const parts =
  at >= 0 ? process.argv[at + 1].split(",") : ["sign", "copy", "markup", "edit", "export"];
const id = Date.now().toString(36).slice(-6);
const password = `tide-${id}-pool`;
const person = { name: `p9ann${id}`, fullName: `Ann ${id}`, password };
const other = { name: `p9bob${id}`, fullName: `Bob ${id}`, password };
const compose = (page) => page.locator(".mac-mail-compose").last();

const seen = (check, ms = 15_000) => within(ms, check).then((took) => took !== null);
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
const launch = (page, name) => openFromDock(page, name, undefined).catch(() => {});
const menuRow = (page, text) => page.getByRole("menuitem", { name: text, exact: true }).first();
const menuBar = (page, text) =>
  page.getByRole("menubar").getByRole("menuitem", { name: text, exact: true }).first();

/** A picture on the drive, through the routes Finder's uploads use. */
async function pictureOnDrive(page, name) {
  return page.evaluate(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 200;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 400, 200);
    context.fillStyle = "#00ff00";
    context.fillRect(0, 0, 200, 200);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
    const json = { "content-type": "application/json" };
    const opened = await (
      await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "documents",
          name,
          size: blob.size,
          type: "image/png",
          existing: "fail",
        }),
      })
    ).json();
    await fetch(`/api/files/uploads/${opened.upload}/0`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/octet-stream" },
      body: await blob.arrayBuffer(),
    });
    const done = await fetch(`/api/files/uploads/${opened.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    });
    return done.status;
  }, name);
}

const previewWindow = (page) =>
  page.locator('.mac-managed-window[data-window-id="preview"]').first();

/** Finder's Documents: the file shown, double-clicked, opens in Preview. */
async function openInPreview(page, name) {
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = finder.getByRole("option", { name, exact: true }).first();
  await file.waitFor({ timeout: 15_000 });
  await file.dblclick();
  const preview = previewWindow(page);
  await preview.waitFor({ timeout: 15_000 });
  await seen(() => preview.locator(".mac-preview-app-page-canvas").first().isVisible());
  return preview;
}

const signaturesOnServer = async (page) =>
  (await api(page, "GET", "/api/preview/signatures")).json?.signatures ?? [];

const showMarkup = async (page) => {
  const bar = page.getByRole("toolbar", { name: "Markup" }).first();
  if (await bar.isVisible().catch(() => false)) return bar;
  await menuBar(page, "View").click();
  await menuRow(page, "Show Markup Toolbar").click();
  await bar.waitFor({ timeout: 8_000 });
  return bar;
};

async function sign(page) {
  const preview = await openInPreview(page, `Sign ${id}.png`);
  const bar = await showMarkup(page);
  await bar.getByRole("button", { name: "Sign", exact: true }).click();
  await menuRow(page, "Create Signature…").click();
  const sheet = page.getByRole("dialog").filter({ hasText: "Sign your name" }).first();
  await sheet.waitFor({ timeout: 8_000 });
  await sheet
    .getByRole("radio", { name: "Camera" })
    .or(sheet.getByRole("button", { name: "Camera" }))
    .first()
    .click();
  const video = sheet.locator("video");
  step(
    "Camera asks for the camera and shows its picture (Chromium's fake camera playing a Y4M stands in)",
    await seen(() => video.evaluate((each) => each.videoWidth === 640)),
  );
  const done = sheet.getByRole("button", { name: "Done", exact: true });
  step("what is held up is read: Done becomes possible", await seen(() => done.isEnabled()));
  const read = sheet.getByRole("img", { name: "Signature read from the camera" });
  const inked = await read.evaluate((canvas) => {
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let at = 3; at < data.length; at += 4) if (data[at] > 128) dark += 1;
    return dark;
  });
  step("the sheet draws what it read", inked > 200, `${inked} pixels of ink`);
  await shot(page, "p9-sign-camera");
  await done.click();
  await video.waitFor({ state: "detached", timeout: 10_000 });
  const stored = await seen(async () => (await signaturesOnServer(page)).length === 1);
  const [signature] = await signaturesOnServer(page);
  const points = signature?.strokes?.flat() ?? [];
  const us = points.map(([u]) => u);
  const vs = points.map(([, v]) => v);
  step(
    "the signature from the camera is on the server, a wave wider than high, thinned to a line",
    stored &&
      signature.aspect > 3 &&
      points.length > 100 &&
      Math.max(...us) - Math.min(...us) > 0.9 &&
      Math.max(...vs) - Math.min(...vs) > 0.8,
    `aspect ${signature?.aspect}, ${signature?.strokes?.length} strokes, ${points.length} points`,
  );
  // The pad's signature joins the same list.
  await bar.getByRole("button", { name: "Sign", exact: true }).click();
  step(
    "the camera's signature is the first row of the Sign menu",
    await seen(() => menuRow(page, "Signature 1").isVisible()),
  );
  await menuRow(page, "Create Signature…").click();
  const again = page.getByRole("dialog").filter({ hasText: "Sign your name" }).first();
  await again.waitFor({ timeout: 8_000 });
  const pad = again.getByRole("img", { name: "Signature pad" });
  await pad.waitFor({ timeout: 8_000 });
  // The sheet slides down as it opens: the pad is drawn on where it comes to rest.
  await page.waitForTimeout(800);
  const box = await pad.boundingBox();
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 90, { steps: 6 });
  await page.mouse.up();
  await again.getByRole("button", { name: "Done", exact: true }).click();
  await within(5_000, () => preview.isVisible());
  await reload(page);
  const seenTwo = await seen(async () => (await signaturesOnServer(page)).length === 2);
  step("the pad's signature is kept beside it", seenTwo);
  const kept = await signaturesOnServer(page);
  await reload(page);
  const afterReload = await signaturesOnServer(page);
  step(
    "the trackpad's signature and the camera's are one list, kept across a reload",
    afterReload.length === 2 &&
      afterReload.some((each) => each.id === signature.id) &&
      afterReload.map((each) => each.id).join() === kept.map((each) => each.id).join(),
    `${afterReload.length} kept`,
  );
}

const clipboardPicture = (page) =>
  page.evaluate(async () => {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.includes("image/png")) {
        const bitmap = await createImageBitmap(await item.getType("image/png"));
        return { width: bitmap.width, height: bitmap.height, types: item.types };
      }
    }
    return null;
  });

async function copyAndPaste(page) {
  const preview = await openInPreview(page, `Copy ${id}.png`);
  await preview
    .getByRole("document")
    .first()
    .focus()
    .catch(() => {});
  // A file opening keeps Preview busy a moment, and Copy then does nothing: asked again until it has.
  let whole = null;
  for (let tries = 0; tries < 6 && whole === null; tries += 1) {
    await menuBar(page, "Edit").click();
    await menuRow(page, "Copy").click();
    whole = await within(2_500, async () => (await clipboardPicture(page))?.width === 400);
  }
  const picture = await clipboardPicture(page);
  step(
    "Edit > Copy of a picture puts its PNG on the clipboard",
    whole !== null && picture?.height === 200,
    JSON.stringify(picture),
  );

  const bar = await showMarkup(page);
  await bar.getByRole("button", { name: "Rectangular Selection", exact: true }).click();
  const place = await preview.locator('[data-page="1"]').first().boundingBox();
  await page.mouse.move(place.x + place.width * 0.1, place.y + place.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(place.x + place.width * 0.4, place.y + place.height * 0.6, { steps: 5 });
  await page.mouse.up();
  await menuBar(page, "Edit").click();
  await menuRow(page, "Copy").click();
  const part = await within(8_000, async () => {
    const now = await clipboardPicture(page);
    return now && now.width !== 400;
  });
  const selected = await clipboardPicture(page);
  step(
    "Edit > Copy with a selection puts the selection alone there",
    part !== null && selected.width > 80 && selected.width < 160 && selected.height > 60,
    JSON.stringify(selected),
  );

  // A note: stored as a picture on the server.
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes", exact: true }).first();
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 15_000 });
  await notes
    .getByRole("toolbar", { name: "Notes toolbar" })
    .getByRole("button", { name: "New Note" })
    .click();
  const editor = notes.locator('[aria-label="Note"]:visible').first();
  await editor.waitFor({ timeout: 10_000 });
  await editor.click();
  await page.keyboard.type(`Pasted ${id}`);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+V");
  step(
    "Preview's picture pastes into a note as a picture",
    await seen(async () => (await editor.locator("img").count()) === 1),
  );

  // A New Message: an attachment.
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await viewer(page).waitFor({ timeout: 20_000 });
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const message = compose(page);
  await message.waitFor({ timeout: 10_000 });
  await message.getByRole("textbox", { name: "Message" }).click();
  await page.keyboard.press("Control+V");
  const strip = message.getByRole("list", { name: "Attachments" });
  step(
    "and into a New Message as an attachment",
    await seen(async () => (await strip.getByRole("listitem").count()) === 1),
  );

  // Messages: goes to the conversation, and the other person's copy is on the server.
  await openFromDock(page, "Messages");
  const messages = page.locator('.mac-messages[aria-label="Messages"]').first();
  await messages.getByRole("button", { name: "Compose new message" }).click();
  await messages.getByRole("textbox", { name: "To" }).fill(other.name);
  const field = messages.getByRole("textbox", { name: "Message" });
  await field.fill(`hello ${id}`);
  await field.press("Enter");
  await page.waitForTimeout(1_500);
  const pictures = () => messages.locator('img[src^="blob:"]').count();
  const before = await pictures();
  await field.click();
  await page.keyboard.press("Control+V");
  step(
    "and into Messages, as a picture in the conversation",
    await seen(async () => (await pictures()) > before, 20_000),
    `${before} pictures before`,
  );
}

async function markupSheet(page) {
  await openFromDock(page, "Mail", undefined).catch(() => {});
  await viewer(page).waitFor({ timeout: 20_000 });
  await viewer(page).getByRole("button", { name: "New Message" }).click();
  const message = compose(page);
  await message.waitFor({ timeout: 10_000 });
  const white = Buffer.from(
    await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 200;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 400, 200);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
      return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));
    }),
    "base64",
  );
  await message.getByRole("button", { name: "Attach", exact: true }).click();
  await page
    .getByLabel("Files from this computer", { exact: true })
    .last()
    .setInputFiles({ name: "plan.png", mimeType: "image/png", buffer: white });
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .click()
    .catch(() => {});
  const open = message.getByLabel("Markup", { exact: true }).first();
  await seen(() => open.isEnabled());
  await open.click();
  const sheet = page.getByRole("dialog", { name: /^Markup: plan\.png/ });
  await sheet.waitFor({ timeout: 8_000 });
  const canvas = sheet.getByLabel("Picture to mark up");
  await seen(async () => (await canvas.evaluate((each) => each.width)) === 400);
  const box = await canvas.boundingBox();
  const spot = (x, y) => [box.x + (x / 400) * box.width, box.y + (y / 200) * box.height];
  const drag = async (from, to) => {
    await page.mouse.move(...spot(...from));
    await page.mouse.down();
    await page.mouse.move(...spot(...to), { steps: 5 });
    await page.mouse.up();
  };
  const tool = (name) =>
    sheet.getByRole("toolbar", { name: "Markup tools" }).getByRole("button", { name, exact: true });
  const pixelsNow = () =>
    canvas.evaluate((element) => {
      const context = element.getContext("2d");
      const dark = (x, y) => {
        const [r, g, b] = context.getImageData(x, y, 1, 1).data;
        return r !== 255 || g !== 255 || b !== 255;
      };
      return {
        oldEdge: dark(20, 50),
        movedEdge: dark(220, 90),
        resizedEdge: dark(360, 90),
      };
    });

  await tool("Rectangle").click();
  await drag([20, 20], [120, 80]);
  await tool("Select").click();
  await page.mouse.click(...spot(70, 50));
  step(
    "Select chooses a mark and shows its handles",
    await seen(async () => (await sheet.locator(".mac-mail-markup-handle").count()) === 4),
  );
  await drag([70, 50], [270, 90]);
  await seen(async () => (await pixelsNow()).movedEdge);
  const movedPixels = await pixelsNow();
  step(
    "dragging it moves it: the old place is white, the new one drawn",
    !movedPixels.oldEdge && movedPixels.movedEdge,
    JSON.stringify(movedPixels),
  );
  // The moved box runs from (220,60) to (320,120); its bottom right corner goes to (360,150).
  await drag([320, 120], [360, 150]);
  await seen(async () => (await pixelsNow()).resizedEdge);
  const resized = await pixelsNow();
  step("dragging its corner resizes it", resized.resizedEdge, JSON.stringify(resized));
  await sheet.getByRole("button", { name: "Undo" }).click();
  await seen(async () => !(await pixelsNow()).resizedEdge);
  step(
    "Undo takes back the resize alone",
    !(await pixelsNow()).resizedEdge && (await pixelsNow()).movedEdge,
  );

  const signature = tool("Signature 1");
  const offered = await signature.count();
  if (offered) {
    await signature.click();
    const signed = await seen(() =>
      canvas.evaluate((element) => {
        const { data } = element.getContext("2d").getImageData(120, 60, 160, 80);
        for (let at = 0; at < data.length; at += 4) if (data[at + 1] !== 255) return true;
        return false;
      }),
    );
    step("a signature from Preview's list goes on the picture, chosen", signed);
  } else {
    step(
      "Signature stands dimmed with its reason when Preview keeps none",
      await tool("Signature").isDisabled(),
    );
  }
  await shot(page, "p9-mail-markup");
  await sheet.getByRole("button", { name: "Done" }).click();
  const strip = page
    .getByRole("list", { name: "Attachments" })
    .filter({ hasText: "plan.png" })
    .getByRole("listitem")
    .filter({ hasText: "plan.png" });
  await seen(async () => (await strip.count()) === 1 && /KB|bytes/.test(await strip.innerText()));
  step(
    "Done replaces the attachment with the picture as marked",
    (await strip.count()) === 1,
    JSON.stringify(await page.getByRole("list", { name: "Attachments" }).allInnerTexts()),
  );
}

const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const settingOf = async (page, key) =>
  (await api(page, "GET", "/api/system-preferences/settings")).json.values?.[key];

async function addPhoto(page, name) {
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  if ((await win.count()) === 0) await launch(page, "Photos");
  await win.waitFor({ timeout: 15_000 });
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
  return { win, tile };
}

async function editRecord(page) {
  const name = `Shore ${id}`;
  const { win, tile } = await addPhoto(page, name);
  const before = (await library(page)).photos.find((photo) => photo.name === name);
  await tile.click({ button: "right" });
  await menuRow(page, "Edit With").click();
  await page.waitForTimeout(200);
  await menuRow(page, "Preview").click();
  const preview = page
    .locator('.mac-managed-window[data-window-id^="preview"]')
    .filter({ hasText: name })
    .first();
  await preview.waitFor({ timeout: 15_000 });
  await seen(async () => (await preview.innerText()).includes(name));
  await seen(() => preview.locator(".mac-preview-app-page-canvas").first().isVisible());
  await preview.getByRole("button", { name: "Rotate Left" }).first().click();
  await preview.getByRole("document").first().focus();
  // A file opening keeps Preview busy a moment, and Save then does nothing: asked again until it has.
  const back = await seen(async () => {
    await page.keyboard.press("Control+s");
    return within(
      4_000,
      async () =>
        (await library(page)).photos.find((photo) => photo.id === before.id)?.edit?.external,
    ).then((took) => took !== null);
  }, 20_000);
  const after = (await library(page)).photos.find((photo) => photo.id === before.id);
  const entries = (await api(page, "GET", "/api/files/")).json.entries;
  const record = (await settingOf(page, "photos.editWith"))?.[before.file];
  step(
    "what Preview saved is named in the photo's edit on the server, the original untouched",
    back &&
      after.file === before.file &&
      after.edit.external !== before.file &&
      entries.some((entry) => entry.id === after.edit.external && entry.trashed_ms === undefined) &&
      entries.some((entry) => entry.id === before.file && entry.trashed_ms === undefined),
    JSON.stringify(after?.edit?.external),
  );
  step(
    "and the record of what Preview has open follows it",
    record?.open === after.edit.external && record?.base === after.edit.external,
    JSON.stringify(record),
  );
  await preview.getByRole("button", { name: "Close", exact: true }).first().click();

  // With the record gone, as when it has made room for later photos, the photo still draws what Preview saved.
  await page.waitForTimeout(1_500);
  const settings = (await api(page, "GET", "/api/system-preferences/settings")).json;
  const { [before.file]: _record, ...others } = settings.values["photos.editWith"] ?? {};
  await api(page, "PUT", "/api/system-preferences/settings", {
    values: { ...settings.values, "photos.editWith": others },
    rev: settings.rev,
  });
  await reload(page);
  // Preview's other windows come back over Photos: its Dock icon brings it to the front.
  await launch(page, "Photos");
  await win.waitFor({ timeout: 15_000 });
  await tile.waitFor({ timeout: 30_000 });
  await tile.dblclick();
  const turned = await seen(() =>
    win
      .locator('img[src^="blob:"]')
      .evaluateAll((images) => images.some((image) => image.naturalHeight > image.naturalWidth)),
  );
  await shot(page, "p9-photos-edit-back");
  step(
    "after a reload, with no record left in the setting, the photo draws what Preview saved: turned",
    turned && (await settingOf(page, "photos.editWith"))?.[before.file] === undefined,
  );

  await menuBar(page, "Image").click();
  await menuRow(page, "Revert to Original").click();
  const reverted = await seen(
    async () => (await library(page)).photos.find((photo) => photo.id === before.id)?.edit === null,
  );
  const gone = await seen(async () => {
    const now = (await api(page, "GET", "/api/files/")).json.entries;
    const saved = now.find((entry) => entry.id === after.edit.external);
    return !saved || saved.trashed_ms !== undefined;
  });
  const drawn = await seen(() =>
    win
      .locator('img[src^="blob:"]')
      .evaluateAll((images) =>
        images.some((image) => image.naturalWidth === 480 && image.naturalHeight === 360),
      ),
  );
  step("Revert takes it back: the original shows, Preview's file gone", reverted && gone && drawn);
}

async function exportFolder(page) {
  const first = `Pier ${id}`;
  const second = `Dune ${id}`;
  const { tile } = await addPhoto(page, first);
  const { tile: more } = await addPhoto(page, second);
  const sessions = new Set();
  const urls = [];
  const watching = (request) => {
    if (request.method() === "GET" || !/\/api\/files\//.test(request.url())) return;
    urls.push(request.url());
    sessions.add(new URL(request.url()).searchParams.get("desktop_session") ?? "none");
  };
  page.on("request", watching);
  await tile.click();
  await more.click({ modifiers: ["Shift"] });
  await menuBar(page, "File").click();
  await menuRow(page, "Export…").click();
  await page.getByRole("combobox", { name: "Save To" }).click();
  await page.getByRole("option", { name: "Other…", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const panel = page.locator(".mac-save-panel").first();
  await panel.waitFor({ timeout: 10_000 });
  const folderName = `Trip ${id}`;
  await panel.getByRole("textbox").first().fill(folderName);
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  const landed = await seen(async () => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries;
    const folder = entries.find((entry) => entry.name === folderName);
    return folder && entries.filter((entry) => entry.parent === folder.id).length === 2;
  }, 30_000);
  page.off("request", watching);
  step(
    "Export makes one folder and two files, every change on the drive naming one session",
    landed && sessions.size === 1 && !sessions.has("none"),
    `${urls.length} changes, sessions ${JSON.stringify([...sessions].map((each) => each.slice(0, 8)))}`,
  );
}

await run(
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-video-capture=${signatureVideo()}`,
      ],
    },
  },
  {
    chromium: {
      permissions: ["clipboard-read", "clipboard-write", "camera"],
      acceptDownloads: true,
    },
  },
  async ({ person: signIn }) => {
    await signIn("bob", other);
    const page = await signIn("ann", person);
    if (parts.includes("sign") || parts.includes("copy")) {
      for (const name of [`Sign ${id}.png`, `Copy ${id}.png`]) await pictureOnDrive(page, name);
    }
    for (const [part, drive] of [
      ["sign", sign],
      ["copy", copyAndPaste],
      ["markup", markupSheet],
      ["export", exportFolder],
      ["edit", editRecord],
    ]) {
      if (parts.includes(part)) await drive(page);
    }
  },
);

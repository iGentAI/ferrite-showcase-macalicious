#!/usr/bin/env node
// Real MP4 and MOV files on the desktop served by `ferrite dev`, in Google Chrome, which decodes H.264
// and AAC: Photos imports and plays them and refuses an MP4 of sound alone; QuickTime Player opens a
// movie and sound from Finder; a drop on the Dock tile opens a movie in QuickTime Player and a PDF in
// Preview. Exits 0 only with every step passed and no console or HTTP error. The files are made by
// ffmpeg from test patterns and tones, in the folder --media names. It deletes only what it made.
//
//   ffmpeg -f lavfi -i testsrc=size=320x240:rate=15:duration=3 -f lavfi -i sine=frequency=440:duration=3
//     -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest clip.mp4 (and clip.mov); with sine alone and
//     -vn, soundonly.mp4 and sound.m4a; tone.wav from sine alone.
//   node e2e/media-files-journey.mjs --browser chrome --media <dir> [--url ...] [--out <dir>]

import { readFileSync } from "node:fs";
import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("media-files");
const args = process.argv.slice(2);
const media = args[args.indexOf("--media") + 1];
const tag = Date.now().toString(36);
const LIBRARY = "/api/app-store/library";
const name = (word, extension) => `${word} ${tag}.${extension}`;
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const photoNamed = async (page, wanted) =>
  (await library(page)).photos?.find((photo) => photo.name === wanted);

async function until(check, ms = 20_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const upload = (page, wanted, type, bytes) =>
  page.evaluate(
    async ({ wanted, type, base64 }) => {
      const blob = await fetch(`data:${type};base64,${base64}`).then((reply) => reply.blob());
      const json = { "content-type": "application/json" };
      const uploading = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "documents",
          name: wanted,
          size: blob.size,
          type,
          existing: "fail",
        }),
      }).then((reply) => reply.json());
      for (let index = 0; index < uploading.pieces; index += 1) {
        const piece = blob.slice(
          index * uploading.piece_bytes,
          (index + 1) * uploading.piece_bytes,
        );
        const put = await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await piece.arrayBuffer(),
        });
        if (!put.ok) throw new Error(`piece ${index}: ${put.status}`);
      }
      const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((reply) => reply.json());
      return done.created[0];
    },
    { wanted, type, base64: bytes.toString("base64") },
  );

const minimalPdf = () => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
};

const read = (file) => readFileSync(path.join(media, file));

await run(async (page) => {
  const madeFiles = [];
  const madePhotos = [];
  // What this run installed, and only that goes back out.
  const addedApps = [];
  try {
    await openDesktop(page, base, step);
    const installed = (await api(page, "GET", LIBRARY)).json;
    const held = installed.installed ?? [];
    for (const id of ["quicktime-player", "preview"]) if (!held.includes(id)) addedApps.push(id);
    await api(page, "PUT", LIBRARY, {
      installed: [...held, ...addedApps],
      rev: installed.rev,
    });
    const OPEN = name("Open", "mp4");
    const DROP = name("Drop", "mov");
    const TONE = name("Tone", "wav");
    const NOTE = name("Note", "m4a");
    const PAGES = name("Paper", "pdf");
    for (const [wanted, type, bytes] of [
      [OPEN, "video/mp4", read("clip.mp4")],
      [DROP, "video/quicktime", read("clip.mov")],
      [TONE, "audio/wav", read("tone.wav")],
      [NOTE, "audio/mp4", read("sound.m4a")],
      [PAGES, "application/pdf", minimalPdf()],
    ]) {
      madeFiles.push(await upload(page, wanted, type, bytes));
    }
    step("the files are on the drive", madeFiles.every(Boolean));
    await page.reload();
    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.waitFor({ timeout: 30_000 });

    // Photos: an MP4 and a MOV from the computer, and an MP4 of sound alone.
    await dock.getByRole("button", { name: "Photos", exact: true }).click();
    const photos = page.locator(".mac-window:has(.mac-photos-body)").first();
    await photos.waitFor({ timeout: 10_000 });
    await until(async () => !(await photos.getAttribute("aria-busy")));
    const MP4 = `Clip ${tag}`;
    const MOV = `Reel ${tag}`;
    const SOUND = `Hum ${tag}`;
    await photos
      .locator("input[type=file]")
      .first()
      .setInputFiles([
        { name: `${MP4}.mp4`, mimeType: "video/mp4", buffer: read("clip.mp4") },
        { name: `${MOV}.mov`, mimeType: "video/quicktime", buffer: read("clip.mov") },
        { name: `${SOUND}.mp4`, mimeType: "video/mp4", buffer: read("soundonly.mp4") },
      ]);
    const mp4 = await until(() => photoNamed(page, MP4), 30_000);
    const mov = await until(() => photoNamed(page, MOV), 30_000);
    madePhotos.push(mp4, mov);
    const shaped = (photo, mime) =>
      photo?.mime === mime &&
      photo?.width === 320 &&
      photo?.height === 240 &&
      Math.abs((photo?.duration_ms ?? 0) - 3000) < 200;
    step(
      "Photos keeps an MP4 with its type, size and length",
      shaped(mp4, "video/mp4"),
      JSON.stringify([mp4?.mime, mp4?.width, mp4?.height, mp4?.duration_ms]),
    );
    step(
      "Photos keeps a MOV with its type, size and length",
      shaped(mov, "video/quicktime"),
      JSON.stringify([mov?.mime, mov?.width, mov?.height, mov?.duration_ms]),
    );
    const refusal = await until(async () => {
      const text = (await photos.textContent()) ?? "";
      return text.includes("has sound but no picture") ? text : null;
    });
    step(
      "an MP4 of sound alone is refused by name",
      Boolean(refusal?.includes(`${SOUND}.mp4`)) && !(await photoNamed(page, SOUND)),
    );
    const tile = photos
      .getByRole("button", { name: MOV, exact: true })
      .or(photos.getByRole("option", { name: MOV, exact: true }))
      .first();
    await tile.waitFor({ timeout: 15_000 });
    await tile.dblclick();
    const inPhotos = photos.locator("video.mac-photos-picture");
    await inPhotos.waitFor({ timeout: 15_000 });
    await until(() => inPhotos.evaluate((video) => video.readyState >= 2));
    // The browser's own controls: a click on the picture plays it.
    await inPhotos.click();
    const moved = await until(() => inPhotos.evaluate((video) => video.currentTime > 0.2));
    step("a MOV plays in Photos", moved === true);
    await shot(page, path.join(out, "media-photos-mov.png"));
    await inPhotos.click();
    await page.keyboard.press("Escape");

    // QuickTime Player: from Finder.
    await dock.getByRole("button", { name: "Finder" }).click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: 10_000 });
    await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    const entry = (wanted) => finder.getByRole("option", { name: wanted, exact: true }).first();
    const titled = (wanted) =>
      page.waitForFunction(
        (wanted) =>
          [
            ...document.querySelectorAll(
              '.mac-managed-window[data-window-id="quicktime-player"] .mac-title-bar-title-text',
            ),
          ].some((title) => title.textContent?.includes(wanted)),
        wanted,
        { timeout: 20_000 },
      );
    const player = page.locator(".mac-quicktime-player").first();
    const video = (reading) => player.locator("video, audio").first().evaluate(reading);
    const plays = async () => {
      await until(() => video((each) => each.readyState >= 2));
      await player.hover();
      await player.getByRole("button", { name: "Play", exact: true }).click();
      const on = await until(() => video((each) => each.currentTime > 0.2));
      await player.getByRole("button", { name: "Pause", exact: true }).click();
      return on === true && (await video((each) => Math.abs(each.duration - 3) < 0.3));
    };
    await entry(OPEN).dblclick();
    await titled(OPEN);
    step("a double-click on an MP4 opens it in QuickTime Player, and it plays", await plays());
    await page.waitForTimeout(300);
    await shot(page, path.join(out, "media-quicktime-mp4.png"));

    // A drop on a Dock tile.
    const dropOnTile = async (wanted, label) => {
      await dock.getByRole("button", { name: "Finder" }).click();
      const row = entry(wanted);
      await row.waitFor({ timeout: 15_000 });
      const from = await row.boundingBox();
      const to = await dock.getByRole("button", { name: label, exact: true }).boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, {
        steps: 4,
      });
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
      await page.waitForTimeout(200);
      await page.mouse.up();
    };
    await dropOnTile(DROP, "QuickTime Player");
    await titled(DROP);
    step("a MOV dropped on QuickTime Player's Dock tile opens, and it plays", await plays());

    // Sound opens in Music by default, as on a Mac: QuickTime Player takes it when handed it.
    await dropOnTile(TONE, "QuickTime Player");
    await titled(TONE);
    step("a WAV dropped on QuickTime Player's Dock tile opens, and it plays", await plays());
    await dropOnTile(NOTE, "QuickTime Player");
    await titled(NOTE);
    step("an M4A dropped on QuickTime Player's Dock tile opens, and it plays", await plays());
    await shot(page, path.join(out, "media-quicktime-sound.png"));

    await dropOnTile(PAGES, "Preview");
    const previewTitle = page.locator(".mac-preview-app .mac-title-bar-title-text").first();
    const opened = await until(async () =>
      ((await previewTitle.textContent().catch(() => "")) ?? "").includes(PAGES),
    );
    step("a PDF dropped on Preview's Dock tile opens in Preview", opened === true);
    await shot(page, path.join(out, "media-preview-dock.png"));
  } finally {
    // The window removes the originals of deleted photos as it hears of each deletion, and a removal
    // that finds the file already gone answers 404, which counts as removed.
    for (const photo of madePhotos.filter(Boolean)) {
      expectRefusal(404, "/api/files/ops");
      await api(page, "DELETE", `/api/photos/photos/${photo.id}`).catch(() => {});
    }
    const ours = madeFiles.filter(Boolean);
    if (ours.length > 0) {
      await api(page, "POST", "/api/files/ops", {
        ops: ours.map((id) => ({ op: "delete", id })),
      }).catch(() => {});
    }
    if (addedApps.length > 0) {
      const left = (await api(page, "GET", LIBRARY)).json;
      await api(page, "PUT", LIBRARY, {
        installed: (left?.installed ?? []).filter((id) => !addedApps.includes(id)),
        rev: left?.rev,
      }).catch(() => {});
    }
  }
});

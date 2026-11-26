#!/usr/bin/env node
// Share in Preview, QuickTime Player and Photo Booth on the desktop served by `ferrite dev`: each File > Share >
// Add to Photos, read back from the Photos library; and QuickTime's Rename…, read back from the drive. The camera
// is Chromium's fake device. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/media-share-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { base, out } = options();
const { step, run } = journey("media-share", {
  launchOptions: {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
});
const tag = Date.now().toString(36);
const PICTURE = `Shared ${tag}.png`;

async function until(check, ms = 20_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

await run(async (page) => {
  const LIBRARY = "/api/app-store/library";
  await openDesktop(page, base, step);
  await page.evaluate(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const draw = canvas.getContext("2d");
    draw.fillStyle = "#3366cc";
    draw.fillRect(0, 0, 200, 100);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
    const json = { "content-type": "application/json" };
    const uploading = await fetch("/api/files/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: JSON.stringify({
        parent: "pictures",
        name,
        size: blob.size,
        type: blob.type,
        existing: "fail",
      }),
    }).then((response) => response.json());
    await fetch(`/api/files/uploads/${uploading.upload}/0`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/octet-stream" },
      body: await blob.arrayBuffer(),
    });
    await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    });
  }, PICTURE);
  const held = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    installed: [
      ...new Set([...(held.installed ?? []), "preview", "quicktime-player", "photo-booth"]),
    ],
    rev: held.rev,
  });
  await reloadDesktop(page);

  const launch = async (name) => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(name);
    await field.press("Enter");
  };
  const bar = page.getByRole("menubar").first();
  const shareToPhotos = async (shotName) => {
    await bar.getByRole("menuitem", { name: "File", exact: true }).click();
    await page.getByRole("menuitem", { name: "Share", exact: true }).click();
    const row = page.getByRole("menuitem", { name: "Add to Photos", exact: true });
    await row.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(250);
    if (shotName) await shot(page, path.join(out, shotName));
    await row.click();
  };
  const photos = async () => (await api(page, "GET", "/api/photos/library")).json.photos ?? [];

  // Preview: a picture.
  const preview = page.locator(".mac-preview-app").first();
  await launch("Preview");
  await preview.waitFor({ state: "visible", timeout: 15_000 });
  const dialog = page.getByRole("dialog", { name: "Open" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await preview.getByRole("button", { name: "Open…" }).first().click();
  }
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await dialog.getByRole("option", { name: PICTURE }).dblclick({ timeout: 10_000 });
  await preview.locator('[data-page="1"]').first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
  const before = (await photos()).length;
  await shareToPhotos("preview-share.png");
  step(
    "Preview's Share > Add to Photos imports the picture",
    (await until(async () => (await photos()).length === before + 1)) === true,
  );

  // QuickTime Player: a movie, renamed, then shared.
  await launch("QuickTime Player");
  const qt = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  await qt.waitFor({ state: "visible", timeout: 15_000 });
  const chooser = page.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await chooser).setFiles(path.join(here, "fixtures", "test-pattern.webm"));
  const video = qt.locator("video.mac-quicktime-player-video");
  await until(() => video.evaluate((each) => each.videoWidth > 0));
  const NEW_NAME = `Renamed ${tag}`;
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rename…", exact: true }).click();
  await page.getByRole("textbox", { name: "Name of the movie" }).fill(NEW_NAME);
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "quicktime-rename.png"));
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  const renamed = await until(async () =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).some(
      (each) => each.name === `${NEW_NAME}.webm`,
    ),
  );
  await until(async () => (await qt.innerText()).includes(NEW_NAME), 5_000);
  step(
    "Rename… renames the movie on the drive, and the window says so",
    renamed === true && (await page.getByText(NEW_NAME).count()) > 0,
  );
  const beforeMovie = (await photos()).length;
  await shareToPhotos("quicktime-share.png");
  step(
    "QuickTime's Share > Add to Photos imports the movie",
    (await until(async () => (await photos()).length === beforeMovie + 1, 40_000)) === true,
  );

  // Photo Booth: a picture taken here.
  await launch("Photo Booth");
  const booth = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
  await booth.waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => !(await booth.getAttribute("aria-busy")));
  await booth.getByRole("button", { name: "Normal", exact: true }).first().click();
  await until(() =>
    booth.locator(".mac-photo-booth-frame video").evaluate((each) => each.videoWidth > 0),
  );
  const beforeTake = (await photos()).length;
  await booth.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
  await until(async () => (await photos()).length === beforeTake + 1);
  await booth
    .locator(".mac-photo-booth-strip button, .mac-photo-booth-strip [role=option]")
    .first()
    .click();
  await page.evaluate(() => {
    window.__shared = null;
    window.addEventListener(
      "macalicious:share-files",
      (event) => {
        window.__shared = event.detail;
      },
      { once: true, capture: true },
    );
  });
  await shareToPhotos("photo-booth-share.png");
  const handed = await until(() => page.evaluate(() => window.__shared));
  step(
    "Photo Booth's Share hands Photos the picture's file",
    handed?.to === "photos" && handed?.from === "photo-booth" && handed?.items?.length === 1,
    JSON.stringify(handed),
  );
});

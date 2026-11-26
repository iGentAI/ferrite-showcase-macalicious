#!/usr/bin/env node
// Batch 11 of Photos' rows, in a real browser against the running app. A hash of each thumbnail is worked out in the page and
// kept with its photo, read back from GET /api/photos/library across a reload; Days leaves out near-duplicates with a Show
// All link per day; a memory holds one of a burst, plays and exports as a movie, silent with no song in Music, decoded here; Safari's Add Image to
// Photos brings in a picture of a real page, byte for byte. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/photos-rows-batch11-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("photos-rows-batch11", { ignoreOtherOrigins: true });
const tag = Date.now().toString(36);
const PAGE = "en.wikipedia.org/wiki/MacOS_Catalina";
const TINTS = {
  red: [1, 0.3, 0.3],
  green: [0.3, 1, 0.3],
  blue: [0.3, 0.3, 1],
  yellow: [1, 1, 0.25],
};
// A burst: one grid of cells, each a little brighter than the last. Then three other pictures, each its own grid and colour.
const PICTURES = [
  { name: `Burst 1 ${tag}`, seed: 11, tint: "red", brighter: 0 },
  { name: `Burst 2 ${tag}`, seed: 11, tint: "red", brighter: 6 },
  { name: `Burst 3 ${tag}`, seed: 11, tint: "red", brighter: 12 },
  { name: `Other ${tag}`, seed: 29, tint: "green", brighter: 0 },
  { name: `Third ${tag}`, seed: 53, tint: "blue", brighter: 0 },
  { name: `Fourth ${tag}`, seed: 97, tint: "yellow", brighter: 0 },
];

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const photosWindow = (page) => page.locator(".mac-window:has(.mac-photos-body)").first();
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const tiles = (win, name) =>
  win.getByRole("button", { name }).or(win.getByRole("option", { name }));
const named = async (page, name) =>
  ((await library(page)).photos ?? []).find((photo) => photo.name === name);

const importPictures = async (win) => {
  const transfer = await win.page().evaluateHandle(
    async ({ pictures, tints }) => {
      const data = new DataTransfer();
      for (const { name, seed, tint, brighter } of pictures) {
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 480;
        const context = canvas.getContext("2d");
        let state = seed;
        for (let row = 0; row < 8; row += 1) {
          for (let column = 0; column < 9; column += 1) {
            state = (state * 137 + 71) % 1009;
            const level = 50 + (state % 170) + brighter;
            const [r, g, b] = tints[tint].map((part) => Math.round(level * part));
            context.fillStyle = `rgb(${r},${g},${b})`;
            context.fillRect(column * 80, row * 60, 80, 60);
          }
        }
        const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.92));
        data.items.add(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      }
      return data;
    },
    { pictures: PICTURES, tints: TINTS },
  );
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);
};

/** What the movie's frames show and how long it runs, decoded in the page from the stored file. */
const decodeMovie = (page, file, seconds) =>
  page.evaluate(
    async ({ id, size, seconds }) => {
      const parts = [];
      for (let piece = 0; piece * 262144 < size; piece += 8) {
        const reply = await fetch(`/api/files/content/${id}?piece=${piece}&count=8`, {
          credentials: "same-origin",
        });
        parts.push(await reply.blob());
      }
      const blob = new Blob(parts, { type: "video/webm" });
      const video = document.createElement("video");
      video.muted = true;
      video.src = URL.createObjectURL(blob);
      await new Promise((done) => {
        video.onloadedmetadata = done;
      });
      const seek = async (time) => {
        video.currentTime = time;
        await new Promise((done) => {
          video.onseeked = done;
        });
      };
      await seek(1e6);
      const duration = video.currentTime;
      const frames = [];
      for (const time of seconds) {
        await seek(time);
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 9;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(video, 0, 0, 16, 9);
        const { data } = context.getImageData(0, 0, 16, 9);
        const mean = [0, 0, 0];
        for (let at = 0; at < data.length; at += 4) {
          for (const part of [0, 1, 2]) mean[part] += data[at + part] / (data.length / 4);
        }
        frames.push(mean.map(Math.round));
      }
      let loudness = 0;
      try {
        const decoded = await new OfflineAudioContext(1, 1, 48_000).decodeAudioData(
          await blob.arrayBuffer(),
        );
        const samples = decoded.getChannelData(0);
        loudness = Math.sqrt(samples.reduce((sum, each) => sum + each * each, 0) / samples.length);
      } catch {
        loudness = 0;
      }
      return { duration, frames, loudness };
    },
    { id: file.id, size: file.size, seconds },
  );

const tintOf = ([r, g, b]) => {
  if (r > 1.5 * b && g > 1.5 * b) return "yellow";
  if (r > 1.5 * g && r > 1.5 * b) return "red";
  if (g > 1.5 * r && g > 1.5 * b) return "green";
  if (b > 1.5 * r && b > 1.5 * g) return "blue";
  return "none";
};

await run(async (page) => {
  const shots = (name) => shot(page, path.join(out, `photos-rows-batch11-${name}.png`));
  await openDesktop(page, base, step);
  await launch(page, "Photos");
  const win = photosWindow(page);
  await win.waitFor({ timeout: 30_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));
  await importPictures(win);

  // ---- The hashes ------------------------------------------------------------------------------
  const hashes = await until(async () => {
    const photos = ((await library(page)).photos ?? []).filter((photo) =>
      PICTURES.some((each) => each.name === photo.name),
    );
    return photos.length === PICTURES.length && photos.every((each) => each.phash)
      ? new Map(photos.map((each) => [each.name, each.phash]))
      : null;
  }, 45_000);
  step(
    "each thumbnail's hash is kept with its photo on the server: 64 bits and a colour, in hex",
    hashes && [...hashes.values()].every((each) => /^[0-9a-f]{22}$/.test(each)),
    hashes ? [...hashes.values()].join(" ") : "no hashes",
  );
  if (!hashes) return;

  // ---- Days ------------------------------------------------------------------------------------
  await win.getByRole("button", { name: "Days", exact: true }).click();
  const burst = tiles(win, /^Burst \d/);
  const all = tiles(win, new RegExp(`${tag}$`));
  const showAll = win.getByRole("button", { name: "Show All 6 Photos", exact: true });
  const showFewer = win.getByRole("button", { name: "Show Fewer Photos", exact: true });
  await showAll.waitFor({ timeout: 10_000 });
  step(
    "Days leaves out the burst's near-duplicates and keeps the different pictures",
    (await burst.count()) === 1 && (await all.count()) === 4,
    `${await burst.count()} of the burst, ${await all.count()} in all`,
  );
  step(
    "the day's line still counts the whole day",
    (await win.locator(".mac-photos-group-heading").first().innerText()).includes("6 Photos"),
    await win.locator(".mac-photos-group-heading").first().innerText(),
  );
  await shots("days-curated");
  await showAll.click();
  await showFewer.waitFor({ timeout: 5_000 });
  step(
    "Show All shows that day's every photo",
    (await burst.count()) === 3 && (await all.count()) === 6,
    `${await all.count()} in all`,
  );
  await shots("days-all");
  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  await until(async () => (await all.count()) === 6, 5_000);
  step("All Photos is not curated", (await all.count()) === 6);
  await win.getByRole("button", { name: "Days", exact: true }).click();
  await showFewer.waitFor({ timeout: 5_000 });
  await showFewer.click();
  await showAll.waitFor({ timeout: 5_000 });
  step("Show Fewer leaves them out again", (await all.count()) === 4);

  // ---- Across a reload -------------------------------------------------------------------------
  const posted = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/photos/hashes") posted.push(request.url());
  });
  await reloadDesktop(page);
  const again = photosWindow(page);
  await again.waitFor({ timeout: 30_000 });
  await again
    .getByRole("button", { name: "Show All 6 Photos", exact: true })
    .waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1_500);
  const after = (await library(page)).photos ?? [];
  step(
    "after a reload the library answers the same hashes",
    PICTURES.every(
      ({ name }) => after.find((each) => each.name === name)?.phash === hashes.get(name),
    ),
  );
  step(
    "and the page, holding them, asks to keep none again",
    posted.length === 0,
    `${posted.length} requests`,
  );
  step(
    "Days is curated from the kept hashes before any thumbnail is hashed again",
    (await tiles(again, /^Burst \d/).count()) === 1 &&
      (await tiles(again, new RegExp(`${tag}$`)).count()) === 4,
  );

  const third = await named(page, PICTURES[2].name);
  const favorite = await api(page, "POST", `/api/photos/photos/${third.id}`, { favorite: true });
  step("a later picture of the burst is made a favourite", favorite.status === 200);
  await reloadDesktop(page);
  const fresh = photosWindow(page);
  await fresh.waitFor({ timeout: 30_000 });
  await tiles(fresh, new RegExp(`^${PICTURES[2].name}$`)).waitFor({ timeout: 20_000 });
  step(
    "a favourite stays, ahead of the earlier picture it resembles",
    (await tiles(fresh, /^Burst \d/).count()) === 1,
  );

  // ---- The route's refusals --------------------------------------------------------------------
  const stale = await api(page, "POST", "/api/photos/hashes", {
    hashes: [{ id: third.id, edited_ms: 1, hash: "a".repeat(22) }],
  });
  step(
    "a hash of an older version of the photo is not kept",
    stale.status === 200 &&
      stale.json.kept.length === 0 &&
      (await named(page, PICTURES[2].name)).phash === hashes.get(PICTURES[2].name),
    JSON.stringify(stale.json),
  );
  expectRefusal(400, "/api/photos/hashes");
  const malformed = await api(page, "POST", "/api/photos/hashes", {
    hashes: [{ id: third.id, edited_ms: null, hash: "not a hash" }],
  });
  step("what is not a hash is refused", malformed.status === 400, JSON.stringify(malformed.json));

  // ---- The memory ------------------------------------------------------------------------------
  await fresh.getByRole("treeitem", { name: "Memories", exact: true }).click();
  const memory = fresh.locator(".mac-photos-memory", { hasNotText: "Best of" }).first();
  await memory.waitFor({ timeout: 15_000 });
  const label = await memory.getAttribute("aria-label");
  step("the memory holds one of the burst: 4 Photos, not 6", /\b4 Photos/.test(label ?? ""), label);
  await memory.click();
  await tiles(fresh, new RegExp(`${tag}$`))
    .first()
    .waitFor({ timeout: 8_000 });
  step(
    "opened, it lists those four",
    (await tiles(fresh, new RegExp(`${tag}$`)).count()) === 4 &&
      (await tiles(fresh, /^Burst \d/).count()) === 1,
  );
  await shots("memory");

  await page.evaluate(() => {
    window.__sounded = 0;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function played() {
      if (!this.muted) window.__sounded += 1;
      return play.call(this);
    };
  });
  await fresh.getByRole("button", { name: "Play Memory Movie", exact: true }).click();
  const stage = page.getByRole("dialog", { name: "Slideshow" });
  await stage.waitFor({ timeout: 8_000 });
  await page.waitForTimeout(800);
  await shots("memory-movie");
  step(
    "Play Memory Movie runs its pictures, moved over slowly",
    (await stage.getAttribute("data-theme")) === "ken-burns",
    await stage.getAttribute("data-theme"),
  );
  await page.waitForTimeout(3_500);
  step("and plays no sound", (await page.evaluate(() => window.__sounded)) === 0);
  await page.keyboard.press("Escape");
  await stage.waitFor({ state: "hidden", timeout: 5_000 });

  await fresh.getByRole("button", { name: "Export Memory Movie…", exact: true }).click();
  await page.getByRole("textbox", { name: /Save As/ }).waitFor({ timeout: 8_000 });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = await until(async () => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
    return entries.find((each) => /\.webm$/.test(each.name));
  }, 90_000);
  step("Export Memory Movie saves a movie on the drive", Boolean(file), file?.name);
  if (file) {
    const movie = await decodeMovie(page, file, [1.5, 4.5, 7.5, 10.5]);
    const seen = movie.frames.map(tintOf);
    step(
      "the movie runs three seconds a picture, for four pictures",
      movie.duration > 10.5 && movie.duration < 15,
      `${movie.duration}`,
    );
    step(
      "its frames show the four pictures, each once",
      [...seen].sort().join() === "blue,green,red,yellow",
      `${seen.join(" ")} ${JSON.stringify(movie.frames)}`,
    );
    step("it is silent", movie.loudness === 0, `${movie.loudness}`);
  }

  // ---- Safari ----------------------------------------------------------------------------------
  await launch(page, "Safari");
  const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  const address = safari
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(safari.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  await address.fill(PAGE);
  await page.keyboard.press("Enter");
  await safari.locator("iframe[srcdoc]").waitFor({ timeout: 40_000 });
  const frame = safari.frameLocator("iframe[srcdoc]");
  const raster = frame
    .locator('img[src^="data:image/png"], img[src^="data:image/jpeg"], img[src^="data:image/webp"]')
    .first();
  const hasPicture = await raster
    .waitFor({ state: "attached", timeout: 40_000 })
    .then(() => true)
    .catch(() => false);
  step("Wikipedia's article is in Safari with its pictures in the page", hasPicture);
  if (!hasPicture) return;
  const picture = await raster.evaluate((image) => ({
    src: image.src,
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  await raster.scrollIntoViewIfNeeded();
  await raster.click({ button: "right" });
  const add = page.getByRole("menuitem", { name: "Add Image to Photos", exact: true });
  await add.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  await shots("safari-menu");
  await add.click();
  const added = await until(async () => {
    const photos = (await library(page)).photos ?? [];
    return photos.find((each) => each.name === "image" && each.phash);
  }, 45_000);
  step("Add Image to Photos adds the picture to the library", Boolean(added), added?.name);
  if (!added) return;
  const data = picture.src.slice(picture.src.indexOf(",") + 1);
  const stored = await page.evaluate(async (id) => {
    const reply = await fetch(`/api/files/content/${id}?piece=0&count=8`, {
      credentials: "same-origin",
    });
    const bytes = new Uint8Array(await reply.arrayBuffer());
    return btoa(Array.from(bytes, (each) => String.fromCharCode(each)).join(""));
  }, added.file);
  step(
    "the original kept on the drive is the page's picture, byte for byte",
    stored === data && added.bytes === Buffer.from(data, "base64").length,
    `${added.bytes} bytes, ${added.mime}`,
  );
  step(
    "with the picture's own size",
    added.width === picture.width && added.height === picture.height,
    `${added.width} by ${added.height}`,
  );

  await reloadDesktop(page);
  const last = photosWindow(page);
  await last.waitFor({ timeout: 30_000 });
  await last.getByRole("treeitem", { name: "Photos", exact: true }).click();
  await tiles(last, /^image$/).waitFor({ timeout: 20_000 });
  step("after a reload it is among the day's pictures", true);
  await shots("safari-added");

  // ---- An edit lets go of the hash -------------------------------------------------------------
  const other = await named(page, PICTURES[3].name);
  const thumb = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.8));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return btoa(Array.from(bytes, (each) => String.fromCharCode(each)).join(""));
  });
  const edited = await api(page, "POST", `/api/photos/photos/${other.id}`, {
    edit: { rotate: 1 },
    thumb,
  });
  step(
    "an edit clears the hash, since the thumbnail changes",
    edited.status === 200 && !edited.json.photo?.phash && !(await named(page, other.name)).phash,
    JSON.stringify(edited.json.photo?.phash ?? null),
  );
});

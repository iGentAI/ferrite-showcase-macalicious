#!/usr/bin/env node
// A movie in Photos on the desktop served by `ferrite dev`: a real WebM recorded in the page goes
// through Photos' own Import, and is read back from the server and from the window. Exits 0 only
// with every step passed and no console or HTTP error. It deletes only what it made.
//
//   node e2e/photos-movie-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";
import { ENGINES } from "./journey-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("photos-movie");
const tag = Date.now().toString(36);
const NAME = `Movie ${tag}`;
const library = async (page) => (await api(page, "GET", "/api/photos/library")).json;
const kept = async (page) => (await library(page)).photos?.find((each) => each.name === NAME);

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/**
 * A file recorded by `record` (in a page, answering base64), handed to `page` as a DataTransfer. In
 * each engine `elsewhere` names, Chromium records the same bytes and that engine imports them.
 */
async function recordedFile(page, name, record, elsewhere) {
  const helper = elsewhere.includes(browserName) ? await ENGINES.chromium.launch() : null;
  try {
    const where = helper ? await helper.newPage() : page;
    const bytes = await where.evaluate(record);
    return await page.evaluateHandle(
      ([bytes, name]) => {
        const transfer = new DataTransfer();
        const raw = Uint8Array.from(atob(bytes), (each) => each.charCodeAt(0));
        transfer.items.add(new File([raw], `${name}.webm`, { type: "video/webm" }));
        return transfer;
      },
      [bytes, name],
    );
  } finally {
    await helper?.close();
  }
}

const base64Of = `async (parts) => {
  const raw = new Uint8Array(await new Blob(parts).arrayBuffer());
  let text = "";
  for (const each of raw) text += String.fromCharCode(each);
  return btoa(text);
}`;

/** A second of moving colour, recorded by the browser itself: its file names no length. */
const recorded = (page, name) =>
  recordedFile(
    page,
    name,
    `(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d");
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const parts = [];
    recorder.ondataavailable = (event) => parts.push(event.data);
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();
    const started = performance.now();
    while (performance.now() - started < 2500) {
      const hue = Math.round((performance.now() - started) / 3);
      context.fillStyle = \`hsl(\${hue} 80% 50%)\`;
      context.fillRect(0, 0, 320, 240);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    recorder.stop();
    await stopped;
    return (${base64Of})(parts);
  })()`,
    // WebKit on Linux has no MediaRecorder.
    ["webkit"],
  );

/** Sound alone, in the same WebM container as a movie. */
const recordedSound = (page, name) =>
  recordedFile(
    page,
    name,
    `(async () => {
    const audio = new AudioContext();
    await audio.resume();
    const tone = audio.createOscillator();
    const out = audio.createMediaStreamDestination();
    tone.connect(out);
    tone.start();
    const recorder = new MediaRecorder(out.stream, { mimeType: "audio/webm" });
    const parts = [];
    recorder.ondataavailable = (event) => parts.push(event.data);
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 800));
    recorder.stop();
    await stopped;
    tone.stop();
    await audio.close();
    return (${base64Of})(parts);
  })()`,
    // Headless Firefox here never finishes this recording, with or without its autoplay switch.
    ["webkit", "firefox"],
  );

await run(async (page) => {
  const shots = (name) => shot(page, path.join(out, `photos-movie-${name}.png`));
  await openDesktop(page, base, step);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photos");
  await field.press("Enter");
  const win = page.locator(".mac-window:has(.mac-photos-body)").first();
  await win.waitFor({ timeout: 10_000 });
  await until(async () => !(await win.getAttribute("aria-busy")));

  const transfer = await recorded(page, NAME);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, transfer);

  const movie = await until(() => kept(page), 30_000);
  step(
    "Import keeps a recorded movie, with its type, size and length",
    movie?.mime === "video/webm" &&
      movie?.width === 320 &&
      movie?.height === 240 &&
      movie?.duration_ms >= 500 &&
      movie?.duration_ms <= 4000,
    JSON.stringify({ mime: movie?.mime, ms: movie?.duration_ms }),
  );

  const soundName = `Sound ${tag}`;
  const sound = await recordedSound(page, soundName);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, sound);
  const notice = page.getByRole("alert").filter({ hasText: soundName });
  await notice.waitFor({ timeout: 30_000 });
  const said = (await notice.textContent()) ?? "";
  const files = (await api(page, "GET", "/api/files/")).json?.entries ?? [];
  step(
    "a WebM of sound alone is refused by name, and leaves no record or file",
    said.includes("has sound but no picture") &&
      !(await library(page)).photos?.some((each) => each.name === soundName) &&
      !files.some((entry) => entry.name.startsWith(soundName)),
    said,
  );

  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  const tile = win
    .getByRole("option", { name: NAME, exact: true })
    .or(win.getByRole("button", { name: NAME, exact: true }))
    .first();
  await tile.waitFor({ timeout: 10_000 });
  const poster = tile.locator("img");
  await poster.waitFor({ timeout: 10_000 });
  const drawn = await poster.evaluate(
    (image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
  );
  const badge = tile.locator(".mac-photos-duration");
  step(
    "its tile shows a poster frame and a duration badge",
    drawn === true && /^\d+:\d\d$/.test((await badge.textContent()) ?? ""),
    (await badge.textContent()) ?? "",
  );
  await tile.click();
  await shots("grid");

  await page.keyboard.press("ControlOrMeta+r");
  await page.waitForTimeout(500);
  step("Command-R does not put an edit on a movie", (await kept(page))?.edit == null);

  const videos = win.getByRole("treeitem", { name: "Videos" }).first();
  await videos.waitFor({ timeout: 5_000 });
  await videos.click();
  await win.getByRole("heading", { name: "Videos", exact: true }).waitFor({ timeout: 5_000 });
  await tile.waitFor({ timeout: 5_000 });
  step("Media Types lists it under Videos", true);
  await shots("videos-row");

  await tile.dblclick();
  const player = win.locator("video").first();
  await player.waitFor({ timeout: 15_000 });
  await until(() => player.evaluate((video) => video.readyState >= 2 && Boolean(video.src)));
  const length = await until(() =>
    player.evaluate((video) =>
      Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null,
    ),
  );
  step("the player knows the movie's length", length >= 2 && length <= 4, length);
  await page.waitForTimeout(400);
  await shots("length");
  await player.evaluate((video) => {
    video.muted = true;
    return video.play();
  });
  const played = await until(() => player.evaluate((video) => video.currentTime > 0));
  step("a double click opens it, and it plays", played === true);
  await shots("playing");

  // A slideshow of a picture and the movie: the picture for its seconds, the movie for its length.
  await page.keyboard.press("Escape");
  await win
    .locator("video")
    .first()
    .waitFor({ state: "detached", timeout: 5_000 })
    .catch(() => {});
  const stillName = `Still ${tag}`;
  const still = await page.evaluateHandle(async (name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext("2d").fillRect(0, 0, 320, 240);
    const blob = await new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.9));
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([blob], `${name}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now() - 86_400_000,
      }),
    );
    return transfer;
  }, stillName);
  await win
    .locator("input[type=file]")
    .first()
    .evaluate((input, data) => {
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, still);
  await until(
    async () => (await library(page)).photos?.some((each) => each.name === stillName),
    30_000,
  );
  await win.getByRole("treeitem", { name: "Photos" }).first().click();
  await win.getByRole("button", { name: "All Photos", exact: true }).click();
  await page.keyboard.press("Shift+ControlOrMeta+a");
  await win.getByRole("button", { name: "Slideshow", exact: true }).first().click();
  const begin = page.getByRole("button", { name: /^(Play|Start|Play Slideshow)$/ });
  if (
    await begin
      .first()
      .isVisible()
      .catch(() => false)
  )
    await begin.first().click();
  const stage = page.locator(".mac-photos-stage");
  await stage.waitFor({ timeout: 8_000 });
  await stage.locator("img, video").first().waitFor({ timeout: 15_000 });
  step(
    "a slideshow holds the picture and the movie",
    (await stage.locator(".mac-photos-stage-place").textContent()) === "1 of 2",
  );
  const running = await until(
    () =>
      stage
        .locator("video")
        .evaluate((video) => video.currentTime > 0 && !video.controls, undefined, { timeout: 500 })
        .catch(() => false),
    20_000,
  );
  step("the movie runs in the show, with the show's controls", running === true);
  await page.keyboard.press("Space");
  const held = await stage.locator("video").evaluate(
    (video) =>
      new Promise((done) => {
        setTimeout(() => done(video.paused), 300);
      }),
  );
  step("Space pauses the movie in the show", held === true);
  await page.keyboard.press("Space");
  await shots("slideshow-movie");
  await page.keyboard.press("Escape");
  await stage.waitFor({ state: "hidden", timeout: 5_000 });
  const after = await library(page);
  for (const each of (after.photos ?? []).filter((photo) => photo.name.includes(tag))) {
    await api(page, "DELETE", `/api/photos/photos/${each.id}`);
  }
  console.log(`screenshots in ${out}`);
});

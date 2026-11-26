#!/usr/bin/env node
// Photo Booth's tracked effects with a real face: Chromium's fake camera plays a Y4M made here from a
// public-domain portrait (demos/photo-booth/vendor/face-fixture.jpg, NASA) that holds on the left of the
// frame for three seconds, then on the right. Dizzy, Love Birds and Balloons find the face with the
// bundled BlazeFace model, follow it across, and are kept in a still and a clip. The model loads only
// once such an effect shows, from the desktop's own origin, and a model that cannot be read is said in
// words. Exits 0 only with every step passed and no console or HTTP error.
//
// Chromium and Firefox only. Firefox's fake camera (its prefs) plays its own moving colours and cannot
// play a file, so there is no face: it proves the camera, the model's loading and the refused model,
// not tracking and not a saved still. WebKit on Linux has no camera stand-in, so the journey says so and does not run.
//
//   node e2e/faces-batch16-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser <engine>]

import { mkdtempSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { api, journey, openDesktop, options, reloadDesktop } from "./app-journey.mjs";

const { base, out, browserName } = options();
if (browserName === "webkit") {
  console.log("faces-batch16 not run in webkit: it has no camera stand-in on Linux");
  process.exit(0);
}
const hasFace = browserName !== "firefox";
const here = path.dirname(fileURLToPath(import.meta.url));
const PORTRAIT = path.resolve(here, "../../../demos/photo-booth/vendor/face-fixture.jpg");
const [WIDTH, HEIGHT] = [640, 480];
const FRAMES_EACH_SIDE = 45;

/** One frame of the Y4M, in 4:2:0: the portrait against grey, `left` pixels from the frame's edge. */
async function frameAt(portrait, left) {
  const { data } = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#777" },
  })
    .composite([{ input: portrait, left, top: 0 }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const frame = Buffer.alloc((WIDTH * HEIGHT * 3) / 2);
  const luma = (r, g, b) => 16 + 0.257 * r + 0.504 * g + 0.098 * b;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const at = (y * WIDTH + x) * 3;
      frame[y * WIDTH + x] = luma(data[at], data[at + 1], data[at + 2]);
      if (y % 2 === 0 && x % 2 === 0) {
        const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
        const chroma = (y / 2) * (WIDTH / 2) + x / 2;
        frame[WIDTH * HEIGHT + chroma] = 128 - 0.148 * r - 0.291 * g + 0.439 * b;
        frame[(WIDTH * HEIGHT * 5) / 4 + chroma] = 128 + 0.439 * r - 0.368 * g - 0.071 * b;
      }
    }
  }
  return frame;
}

const folder = mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), "faces-"));
const y4m = path.join(folder, "face.y4m");
const portrait = await sharp(readFileSync(PORTRAIT)).resize({ height: HEIGHT }).toBuffer();
const { width: portraitWidth } = await sharp(portrait).metadata();
const sides = [await frameAt(portrait, 0), await frameAt(portrait, WIDTH - portraitWidth)];
const file = openSync(y4m, "w");
writeSync(file, `YUV4MPEG2 W${WIDTH} H${HEIGHT} F15:1 Ip A1:1 C420\n`);
for (const side of sides) {
  for (let n = 0; n < FRAMES_EACH_SIDE; n += 1) {
    writeSync(file, "FRAME\n");
    writeSync(file, side);
  }
}
process.on("exit", () => rmSync(folder, { recursive: true, force: true }));

const { step, run } = journey("faces-batch16", {
  launchOptions: {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-video-capture=${y4m}`,
      ],
    },
    firefox: {
      firefoxUserPrefs: {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": true,
      },
    },
  },
});

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

const booth = async (page) =>
  ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).filter(
    (photo) => photo.source === "photo-booth" && photo.deleted_ms === null,
  );

/** The pixels of a picture or a video's frame near a list of colours, out of all of them. */
const countColours = (element, colours) => {
  const canvas = document.createElement("canvas");
  canvas.width = element.naturalWidth || element.videoWidth;
  canvas.height = element.naturalHeight || element.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(element, 0, 0);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let near = 0;
  for (let at = 0; at < data.length; at += 4) {
    if (
      colours.some(
        ([r, g, b]) =>
          Math.abs(data[at] - r) < 35 &&
          Math.abs(data[at + 1] - g) < 35 &&
          Math.abs(data[at + 2] - b) < 35,
      )
    ) {
      near += 1;
    }
  }
  return near;
};
const BALLOON_COLOURS = [
  [142, 36, 170],
  [67, 160, 71],
];
const BIRD_COLOURS = [[255, 210, 63]];

/** Where a tracked canvas differs from the video under it, and where it says the face is, in
 * fractions of the canvas: the art, read from its pixels and not from what the code says it drew. */
const readArt = (canvas) => {
  const video = canvas.parentElement.querySelector("video");
  const { width, height } = canvas;
  const plain = document.createElement("canvas");
  plain.width = width;
  plain.height = height;
  const context = plain.getContext("2d");
  const aspect = video.clientWidth / video.clientHeight;
  const [vw, vh] = [video.videoWidth, video.videoHeight];
  const shownW = vw / vh > aspect ? Math.round(vh * aspect) : vw;
  const shownH = vw / vh > aspect ? vh : Math.round(vw / aspect);
  context.setTransform(-1, 0, 0, 1, width, 0);
  context.drawImage(
    video,
    (vw - shownW) / 2,
    (vh - shownH) / 2,
    shownW,
    shownH,
    0,
    0,
    width,
    height,
  );
  const a = plain.getContext("2d").getImageData(0, 0, width, height).data;
  const b = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  let [changed, sumX, sumY] = [0, 0, 0];
  for (let y = 0, at = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, at += 4) {
      if (
        Math.abs(a[at] - b[at]) +
          Math.abs(a[at + 1] - b[at + 1]) +
          Math.abs(a[at + 2] - b[at + 2]) >
        120
      ) {
        changed += 1;
        sumX += x;
        sumY += y;
      }
    }
  }
  const [fx, fy, fw, fh] = (canvas.dataset.faces ?? "").split("\n")[0].split(" ").map(Number);
  return {
    faces: canvas.dataset.faces ? canvas.dataset.faces.split("\n").length : 0,
    face: { x: fx, y: fy, width: fw, height: fh, middle: fx + fw / 2 },
    changed,
    artX: changed ? sumX / changed / width : null,
    artY: changed ? sumY / changed / height : null,
  };
};

await run(async (page) => {
  const requests = [];
  page.context().on("request", (request) => requests.push(request.url()));
  const modelRequests = () => requests.filter((url) => /blaze_face_short_range/.test(url));

  await openDesktop(page, base, step);
  const held = (await api(page, "GET", "/api/app-store/library")).json;
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...(held.installed ?? []), "photo-booth"],
    rev: held.rev,
  });
  await reloadDesktop(page);
  const open = async () => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill("Photo Booth");
    await field.press("Enter");
    const window = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
    await window.waitFor({ state: "visible", timeout: 15_000 });
    await until(async () => !(await window.getAttribute("aria-busy")));
    return window;
  };
  let window = await open();
  const toPage3 = async () => {
    await window.getByRole("button", { name: "Page 3 of 4", exact: true }).click();
    await window.getByRole("group", { name: "Effects, page 3 of 4" }).waitFor({ timeout: 5_000 });
  };
  const toEffect = async (name) => {
    const grid = window.getByRole("group", { name: /^Effects, page/ });
    if (!(await grid.isVisible().catch(() => false))) {
      await window.getByRole("button", { name: "Effects", exact: true }).click();
    }
    await toPage3();
    await window.getByRole("button", { name, exact: true }).click();
    await window.locator(".mac-photo-booth-frame video").waitFor({ timeout: 10_000 });
  };
  const canvasOf = (id) => window.locator(`.mac-photo-booth-frame canvas[data-effect="${id}"]`);
  /** The art once the face has stayed put for a moment, as the art glides after a jump. */
  const settledArt = async (id) => {
    const first = await canvasOf(id).evaluate(readArt);
    await page.waitForTimeout(350);
    const art = await canvasOf(id).evaluate(readArt);
    const still = art.faces === 1 && Math.abs(art.face.middle - first.face.middle) < 0.005;
    return still && art.changed > 200 ? art : null;
  };
  const artWhenFound = async (id) => {
    let art = null;
    await until(async () => {
      art = await settledArt(id);
      return art !== null;
    }, 30_000);
    return art;
  };

  await window.getByRole("button", { name: "Normal", exact: true }).first().click();
  const take = window.getByRole("button", { name: "Take Photo" });
  await until(() => take.isEnabled(), 15_000);
  await page.waitForTimeout(500);
  await take.click({ modifiers: ["Alt"] });
  await until(async () => (await booth(page)).length === 1, 20_000);
  const lastTaken = window.locator(".mac-photo-booth-strip img").last();
  await until(() => lastTaken.evaluate((img) => img.complete && img.naturalWidth > 0));
  const normalColours = await lastTaken.evaluate(countColours, BALLOON_COLOURS);
  step(
    "the face model has not been asked for while other effects were in use",
    modelRequests().length === 0,
    `${requests.length} requests so far`,
  );
  step(
    "the code of the face detector has not loaded either",
    !requests.some((url) => /face-model\.worker/.test(url)),
  );

  await window.getByRole("button", { name: "Effects", exact: true }).click();
  await toPage3();
  const names = await window
    .getByRole("group", { name: "Effects, page 3 of 4" })
    .getByRole("button")
    .evaluateAll((all) => all.map((each) => each.getAttribute("aria-label") ?? each.textContent));
  step(
    "page 3 holds Dizzy, Love Birds and Balloons",
    ["Dizzy", "Love Birds", "Balloons"].every((name) => names.includes(name)),
    names.join(", "),
  );
  const previews = window.locator(".mac-photo-booth-preview canvas[data-faces]");
  const previewsFound =
    hasFace &&
    (await until(
      () =>
        previews.evaluateAll(
          (all) => all.length === 3 && all.every((each) => each.dataset.faces !== ""),
        ),
      30_000,
    ));
  step(
    "the three previews each find the face, live, sharing one detector",
    !hasFace || previewsFound === true,
    hasFace ? "" : "not checked: this engine's fake camera shows no face",
  );
  await page.waitForTimeout(400);
  await window.screenshot({ path: path.join(out, "faces-page-3.png") });
  step(
    "the model is read once, from the desktop's own site",
    modelRequests().length === 1 && new URL(modelRequests()[0]).origin === new URL(base).origin,
    modelRequests().join(", "),
  );

  for (const [name, id] of hasFace
    ? [
        ["Dizzy", "dizzy"],
        ["Love Birds", "love-birds"],
        ["Balloons", "balloons"],
      ]
    : []) {
    await toEffect(name);
    const art = await artWhenFound(id);
    step(
      `${name} draws art around the one face in the camera`,
      art?.faces === 1 &&
        art.changed > 200 &&
        Math.abs(art.artX - art.face.middle) < art.face.width,
      JSON.stringify(art),
    );
    await window.screenshot({ path: path.join(out, `faces-${id}.png`) });

    const seen = [];
    await until(async () => {
      const now = await settledArt(id);
      if (now) {
        const last = seen.at(-1);
        if (!last || Math.abs(last.face.middle - now.face.middle) > 0.3) seen.push(now);
      }
      if (seen.length === 2) {
        await window.screenshot({ path: path.join(out, `faces-${id}-moved.png`) });
      }
      return seen.length >= 2;
    }, 15_000);
    const [before, after] = seen;
    const moved = (portraitWidth === undefined ? 0 : WIDTH - portraitWidth) / WIDTH;
    step(
      `${name} follows the face across the frame, and its art goes with it`,
      seen.length === 2 &&
        Math.abs(Math.abs(after.face.middle - before.face.middle) - moved) < 0.08 &&
        Math.abs(Math.abs(after.artX - before.artX) - moved) < 0.15,
      seen
        .map((each) => `face ${each.face.middle.toFixed(3)} art ${each.artX.toFixed(3)}`)
        .concat(`moved ${moved.toFixed(3)}`)
        .join("; "),
    );
  }

  // Balloons is showing: a still keeps them.
  if (hasFace) {
    await until(() => take.isEnabled(), 15_000);
    await take.click({ modifiers: ["Alt"] });
    await until(async () => (await booth(page)).length === 2, 20_000);
    await until(async () => (await lastTaken.getAttribute("src")) !== null);
    await page.waitForTimeout(500);
    const stillColours = await lastTaken.evaluate(countColours, BALLOON_COLOURS);
    const photos = await booth(page);
    step(
      "a still taken with Balloons is saved with the balloons in its pixels",
      stillColours > 500 &&
        stillColours > normalColours * 5 &&
        photos.at(-1)?.effect === "balloons",
      `purple and green pixels: ${stillColours} against ${normalColours} under Normal; effect ${photos.at(-1)?.effect}`,
    );
    await window.locator(`[data-picture-id="${photos.at(-1).id}"]`).click();
    await window.locator("img.mac-photo-booth-viewed").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(400);
    await window.screenshot({ path: path.join(out, "faces-still-balloons.png") });
    await window.getByRole("button", { name: "Back to Camera" }).click();

    await toEffect("Dizzy");
    await artWhenFound("dizzy");
    await window.getByRole("button", { name: "Record a movie clip" }).click();
    await window.getByRole("button", { name: "Record Clip" }).click({ modifiers: ["Alt"] });
    const stop = window.getByRole("button", { name: "Stop", exact: true });
    await stop.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(2_500);
    await stop.click();
    await until(async () => (await booth(page)).length === 3, 30_000);
    const clip = (await booth(page)).find((photo) => photo.mime.startsWith("video/"));
    await window.locator(`[data-picture-id="${clip.id}"]`).click();
    const player = window.locator("video.mac-photo-booth-viewed");
    await player.waitFor({ timeout: 15_000 });
    await player.click();
    await until(() => player.evaluate((each) => each.currentTime > 0.5));
    const clipColours = await player.evaluate(countColours, BIRD_COLOURS);
    await window.screenshot({ path: path.join(out, "faces-clip-dizzy.png") });
    step(
      "a clip recorded with Dizzy holds the birds in its frames",
      clip?.effect === "dizzy" && clipColours > 100,
      `${clip?.mime}, ${clip?.duration_ms} ms; bird-yellow pixels in a frame played back: ${clipColours}`,
    );
    await window.getByRole("button", { name: "Back to Camera" }).click();
  }

  const others = requests.filter((url) => {
    if (/^(data|blob):/.test(url)) return false;
    return new URL(url).origin !== new URL(base).origin;
  });
  step(
    "no request of the whole journey left the desktop's own site",
    others.length === 0,
    others.slice(0, 3).join(", "),
  );

  // A model that cannot be read is said in words, and the camera still shows.
  await page.route(/blaze_face_short_range/, (route) =>
    route.fulfill({ status: 200, body: Buffer.alloc(4096, 0x41) }),
  );
  await reloadDesktop(page);
  window = page.getByRole("region", { name: "Photo Booth", exact: true }).first();
  if (!(await window.isVisible().catch(() => false))) window = await open();
  await until(async () => !(await window.getAttribute("aria-busy")));
  await toEffect("Balloons");
  const said = window.getByText("could not load its face model");
  step(
    "a model file that cannot be read is said in the window",
    await said.waitFor({ timeout: 15_000 }).then(
      () => true,
      () => false,
    ),
  );
  step(
    "and the camera view still paints and takes pictures",
    await until(() => take.isEnabled(), 10_000),
  );
  await window.screenshot({ path: path.join(out, "faces-model-refused.png") });
});

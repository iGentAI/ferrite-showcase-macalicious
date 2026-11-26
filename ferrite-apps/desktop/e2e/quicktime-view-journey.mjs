#!/usr/bin/env node
// QuickTime Player's View menu on the desktop served by `ferrite dev`: a window takes a movie's shape,
// Actual Size, Increase and Decrease Size and Fit to Screen resize it, a smaller page shrinks it,
// Loop starts a movie again at its end, and sound gets a small window with the sizes dimmed.
// Exits 0 only with every step passed and no console or HTTP error. Movies are WebMs recorded in the
// page, and the sound a WebM of a tone. It deletes only what it made.
//
//   node e2e/quicktime-view-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--browser ...]

import path from "node:path";
import { api, journey, openDesktop, options, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("quicktime-view");
const tag = Date.now().toString(36);
const WIDE = `Wide ${tag}.webm`;
const SOUND = `Hum ${tag}.webm`;
const NARROW = `Small ${tag}.webm`;
const LIBRARY = "/api/app-store/library";

const store = (page, blobScript, name) =>
  page.evaluate(
    async ({ blobScript, name }) => {
      // biome-ignore lint/security/noGlobalEval: the journey's own script, in its own browser
      const blob = await eval(blobScript)();
      const json = { "content-type": "application/json" };
      const uploading = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "documents",
          name,
          size: blob.size,
          type: blob.type,
          existing: "fail",
        }),
      }).then((reply) => reply.json());
      for (let index = 0; index < uploading.pieces; index += 1) {
        const piece = blob.slice(
          index * uploading.piece_bytes,
          (index + 1) * uploading.piece_bytes,
        );
        await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await piece.arrayBuffer(),
        });
      }
      const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((reply) => reply.json());
      return done.created[0];
    },
    { blobScript, name },
  );

const WIDE_MOVIE = `async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 400;
  const context = canvas.getContext("2d");
  const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
  const parts = [];
  recorder.ondataavailable = (event) => parts.push(event.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  const started = performance.now();
  while (performance.now() - started < 2000) {
    context.fillStyle = "hsl(" + Math.round((performance.now() - started) / 6) + " 80% 50%)";
    context.fillRect(0, 0, 800, 400);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  recorder.stop();
  await stopped;
  return new Blob(parts, { type: "video/webm" });
}`;
const TONE = `async () => {
  const audio = new AudioContext();
  const oscillator = audio.createOscillator();
  const out = audio.createMediaStreamDestination();
  oscillator.connect(out);
  oscillator.start();
  const recorder = new MediaRecorder(out.stream, { mimeType: "audio/webm" });
  const parts = [];
  recorder.ondataavailable = (event) => parts.push(event.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  recorder.stop();
  await stopped;
  oscillator.stop();
  return new Blob(parts, { type: "audio/webm" });
}`;

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  const made = [];
  let added = false;
  try {
    await openDesktop(page, base, step);
    const held = (await api(page, "GET", LIBRARY)).json;
    added = !(held.installed ?? []).includes("quicktime-player");
    if (added) {
      await api(page, "PUT", LIBRARY, {
        installed: [...(held.installed ?? []), "quicktime-player"],
        rev: held.rev,
      });
    }
    made.push(
      await store(page, WIDE_MOVIE, WIDE),
      await store(page, TONE, SOUND),
      await store(page, WIDE_MOVIE.replaceAll("800", "320").replaceAll("400", "240"), NARROW),
    );
    await page.reload();
    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.waitFor({ timeout: 30_000 });
    await dock.getByRole("button", { name: "Finder" }).click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: 10_000 });
    await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    const entry = (name) => finder.getByRole("option", { name, exact: true }).first();
    await entry(WIDE).dblclick();
    const player = page.locator(".mac-quicktime-player").first();
    await player.locator("video").waitFor({ timeout: 20_000 });
    const box = async () => {
      // Between two files the player's window is briefly not there.
      const shown = await player.boundingBox();
      return { width: Math.round(shown?.width ?? 0), height: Math.round(shown?.height ?? 0) };
    };
    const sizeIs = (width, height) =>
      until(async () => {
        const now = await box();
        return now.width === width && now.height === height;
      });
    step(
      "the window takes the movie's shape and size",
      await sizeIs(800, 400),
      JSON.stringify(await box()),
    );
    await shot(page, path.join(out, "quicktime-view.png"));

    const row = async (name) => {
      await page.getByRole("menuitem", { name: "View", exact: true }).first().click();
      await page
        .getByRole("menuitem", { name, exact: true })
        .or(page.getByRole("menuitemcheckbox", { name, exact: true }))
        .first()
        .click();
      await page.waitForTimeout(250);
    };
    await row("Increase Size");
    step(
      "Increase Size grows it by a quarter",
      await sizeIs(1000, 500),
      JSON.stringify(await box()),
    );
    await row("Decrease Size");
    await row("Decrease Size");
    step("Decrease Size shrinks it", await sizeIs(640, 320), JSON.stringify(await box()));
    await row("Actual Size");
    step("Actual Size gives it back", await sizeIs(800, 400), JSON.stringify(await box()));
    // The keys, on the window.
    await player.focus();
    await page.keyboard.press("ControlOrMeta+Shift+Equal");
    step("Command-plus grows it, with Shift", await sizeIs(1000, 500), JSON.stringify(await box()));
    await page.keyboard.press("ControlOrMeta+Minus");
    step("Command-minus shrinks it", await sizeIs(800, 400), JSON.stringify(await box()));
    await page.keyboard.press("ControlOrMeta+Equal");
    await page.keyboard.press("ControlOrMeta+1");
    step("Command-1 is Actual Size", await sizeIs(800, 400), JSON.stringify(await box()));

    // On a small page the window stays inside it.
    const roomy = page.viewportSize();
    await page.setViewportSize({ width: 400, height: 240 });
    const small = await until(async () => {
      const now = await box();
      return now.width <= 400 && now.height <= 240 ? now : null;
    });
    step(
      "on a 400 by 240 page the window is no larger",
      Boolean(small),
      JSON.stringify(await box()),
    );
    await page.setViewportSize(roomy);
    step(
      "on a large page again it takes its size back",
      await sizeIs(800, 400),
      JSON.stringify(await box()),
    );
    // A movie the page holds smaller than its own size: one Decrease Size shows at once.
    await page.setViewportSize({ width: 620, height: 420 });
    await sizeIs(560, 280);
    const capped = await box();
    await page.keyboard.press("ControlOrMeta+Minus");
    const smaller = await until(async () => (await box()).width < capped.width);
    const after = await box();
    step(
      "one Decrease Size shrinks a window the page has capped, keeping its shape",
      smaller === true && Math.abs(after.width / after.height - 2) < 0.02,
      JSON.stringify({ capped, after }),
    );
    await page.setViewportSize(roomy);
    await page.keyboard.press("ControlOrMeta+1");
    await sizeIs(800, 400);
    await row("Fit to Screen");
    const room = await page.evaluate(() => ({ width: innerWidth - 40, height: innerHeight - 140 }));
    const fitted = await box();
    step(
      "Fit to Screen takes the room it has, keeping the shape",
      (fitted.width === room.width || fitted.height === room.height) &&
        Math.abs(fitted.width / fitted.height - 2) < 0.02,
      JSON.stringify({ fitted, room }),
    );
    await row("Actual Size");
    const video = player.locator("video");

    // Option-Command-L, by the key itself, then the row shows it.
    await player.focus();
    await page.keyboard.press("ControlOrMeta+Alt+KeyL");
    await page.getByRole("menuitem", { name: "View", exact: true }).first().click();
    step(
      "Option-Command-L checks Loop",
      (await page
        .getByRole("menuitemcheckbox", { name: "Loop", exact: true })
        .first()
        .getAttribute("aria-checked")) === "true",
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await player.hover();
    await player.getByRole("button", { name: "Play", exact: true }).click();
    const length = await video.evaluate((each) => each.duration);
    let wrapped = false;
    let last = 0;
    const end = Date.now() + (length + 3) * 1000;
    while (Date.now() < end && !wrapped) {
      const now = await video.evaluate((each) => each.currentTime);
      wrapped = now < last - 0.2;
      last = now;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    step("with Loop on a movie starts again at its end", wrapped, `${length}s`);
    await player
      .getByRole("button", { name: "Pause", exact: true })
      .click()
      .catch(() => {});

    await dock.getByRole("button", { name: "Finder" }).click();
    await entry(NARROW).dblclick();
    step(
      "a small movie's window is as wide as its controller",
      await sizeIs(480, 360),
      JSON.stringify(await box()),
    );
    await row("Increase Size");
    step("one Increase Size grows it", await sizeIs(600, 450), JSON.stringify(await box()));

    await dock.getByRole("button", { name: "Finder" }).click();
    await page.getByRole("toolbar", { name: "Dock" }).waitFor();
    const from = await entry(SOUND).boundingBox();
    const to = await dock
      .getByRole("button", { name: "QuickTime Player", exact: true })
      .boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, {
      steps: 4,
    });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    step("sound gets a small window", await sizeIs(480, 130), JSON.stringify(await box()));
    await page.waitForTimeout(400);
    await shot(page, path.join(out, "quicktime-view-sound.png"));
    await page.getByRole("menuitem", { name: "View", exact: true }).first().click();
    step(
      "the size rows are dimmed for sound",
      (await page
        .getByRole("menuitem", { name: "Actual Size", exact: true })
        .first()
        .getAttribute("aria-disabled")) === "true",
    );
    await page.keyboard.press("Escape");
  } finally {
    const ours = made.filter(Boolean);
    if (ours.length > 0) {
      await api(page, "POST", "/api/files/ops", {
        ops: ours.map((id) => ({ op: "delete", id })),
      }).catch(() => {});
    }
    if (added) {
      const left = (await api(page, "GET", LIBRARY)).json;
      await api(page, "PUT", LIBRARY, {
        installed: (left?.installed ?? []).filter((id) => id !== "quicktime-player"),
        rev: left?.rev,
      }).catch(() => {});
    }
  }
});

#!/usr/bin/env node
// TV: subtitles. A .vtt beside a home video is offered in Controls > Subtitles, shows over the video,
// is on again after a reload, and Off takes it away. Audio is dimmed saying why. The movie is a WebM
// recorded in the page. It deletes only what it made.
//
//   node e2e/tv-subtitles-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-subtitles", { ignoreOtherOrigins: true });
const LIBRARY = "/api/tv/library";
const SETTINGS = "/api/system-preferences/settings";
const NAME = `Coast ${Date.now().toString(36)}`;
const SPOKEN = "Waves on the coast";

const upload = (page, name, type, makeBlob) =>
  page.evaluate(
    async ({ name, type, makeBlob }) => {
      // biome-ignore lint/security/noGlobalEval: the journey's own script, in its own browser
      const blob = await eval(makeBlob)();
      const json = { "content-type": "application/json" };
      const uploading = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent: "movies", name, size: blob.size, type, existing: "fail" }),
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
    { name, type, makeBlob },
  );

const MOVIE = `async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const context = canvas.getContext("2d");
  const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
  const parts = [];
  recorder.ondataavailable = (event) => parts.push(event.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  const started = performance.now();
  while (performance.now() - started < 6000) {
    context.fillStyle = "hsl(" + Math.round((performance.now() - started) / 12) + " 60% 40%)";
    context.fillRect(0, 0, 320, 180);
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  recorder.stop();
  await stopped;
  return new Blob(parts, { type: "video/webm" });
}`;
const CUES = `async () => new Blob([
  "WEBVTT\\n\\n00:00.000 --> 01:00.000\\n${SPOKEN}\\n"
], { type: "text/vtt" })`;

async function openTv(page) {
  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  return window;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const made = [
    await upload(page, `${NAME}.webm`, "video/webm", MOVIE),
    await upload(page, `${NAME}.en.vtt`, "text/vtt", CUES),
  ];
  const before = (await api(page, "GET", LIBRARY)).json;
  try {
    await api(page, "PUT", LIBRARY, {
      library: {
        ...(before.library ?? {
          videos: [],
          history: [],
          upNext: [],
          watchLater: [],
          positions: {},
        }),
        homeVideos: [...(before.library?.homeVideos ?? []), { id: made[0], place: 0 }],
      },
      rev: before.rev,
    });
    await reloadDesktop(page);
    let window = await openTv(page);
    await chooseMenu(page, "View", "Library");
    const card = window.locator(".mac-card-grid-card", { hasText: NAME }).first();
    await card.click();
    const video = window.locator(".mac-tv-player-video video");
    await video.waitFor({ timeout: 5_000 });
    await until(() => video.evaluate((element) => element.readyState >= 1), 10_000);
    const mode = () => video.evaluate((element) => element.textTracks[0]?.mode);
    step(
      "The player offers the file beside the video, not yet showing",
      (await mode()) === "disabled",
      String(await mode()),
    );

    const audio = await menuItemState(page, "Controls", "Audio");
    step("Controls > Audio is dimmed, saying why", audio?.disabled === true, JSON.stringify(audio));

    await chooseMenu(page, "Controls", "Subtitles", "en");
    const cue = () =>
      video.evaluate((element) => element.textTracks[0]?.activeCues?.[0]?.text ?? null);
    step(
      "Choosing it shows its words over the video",
      (await until(async () => (await cue()) === SPOKEN, 8_000)) && (await mode()) === "showing",
      String(await cue()),
    );
    await shot(page, path.join(out, "tv-subtitles.png"));

    step(
      "The choice is kept for the person",
      await until(
        async () => (await api(page, "GET", SETTINGS)).json?.values?.["tv.subtitles"] === "en",
        5_000,
      ),
    );

    await reloadDesktop(page);
    window = await openTv(page);
    await chooseMenu(page, "View", "Library");
    await window.locator(".mac-card-grid-card", { hasText: NAME }).first().click();
    const again = window.locator(".mac-tv-player-video video");
    await again.waitFor({ timeout: 5_000 });
    step(
      "Over a reload they come on by themselves",
      await until(
        () => again.evaluate((element) => element.textTracks[0]?.mode === "showing"),
        10_000,
      ),
    );

    await chooseMenu(page, "Controls", "Subtitles", "Off");
    step(
      "Off takes them away",
      await until(
        () => again.evaluate((element) => element.textTracks[0]?.mode === "disabled"),
        5_000,
      ),
    );
  } finally {
    const left = (await api(page, "GET", LIBRARY)).json;
    await api(page, "PUT", LIBRARY, {
      library: {
        ...left.library,
        homeVideos: (left.library?.homeVideos ?? []).filter((each) => each.id !== made[0]),
      },
      rev: left.rev,
    }).catch(() => {});
    await api(page, "POST", "/api/files/ops", {
      ops: made.map((id) => ({ op: "delete", id })),
    }).catch(() => {});
  }
});

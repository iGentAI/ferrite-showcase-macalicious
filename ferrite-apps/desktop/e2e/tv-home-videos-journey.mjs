#!/usr/bin/env node
// TV: Home Videos. File > Import… takes a movie from the drive, the card plays it in the page, the
// place is kept over a reload, File > Show in Finder shows the file, a drag from Finder adds one, Open
// With TV plays one, and Remove from Library leaves the file in the drive. Movies are WebMs recorded
// in the page. It deletes only what it made.
//
//   node e2e/tv-home-videos-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-home-videos", { ignoreOtherOrigins: true });
const LIBRARY = "/api/tv/library";
const tag = Date.now().toString(36);
const BEACH = `Beach ${tag}`;
const GARDEN = `Garden ${tag}`;
const HARBOUR = `Harbour ${tag}`;
// The dev server can answer nothing for tens of seconds at a time when several journeys share it, and
// a step that crosses it twice (its read of the drive, then the library's save) meets that twice.
const SERVER = 60_000;

const store = (page, name, parent = "movies") =>
  page.evaluate(
    async ({ name, parent }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext("2d");
      const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
      const parts = [];
      recorder.ondataavailable = (event) => parts.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.start();
      const started = performance.now();
      while (performance.now() - started < 5000) {
        context.fillStyle = `hsl(${Math.round((performance.now() - started) / 6)} 80% 50%)`;
        context.fillRect(0, 0, 320, 180);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      recorder.stop();
      await stopped;
      const blob = new Blob(parts, { type: "video/webm" });
      const json = { "content-type": "application/json" };
      const uploading = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent,
          name: `${name}.webm`,
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
    { name, parent },
  );

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
  // The desktop's own requests under way. A reload or the end of the run would cut them off, which is
  // the journey's doing, so each waits for them.
  const underWay = new Set();
  const ours = (request) => {
    const { origin, pathname } = new URL(request.url());
    return origin === new URL(base).origin && pathname.startsWith("/api/");
  };
  page.on("request", (request) => {
    if (ours(request)) underWay.add(request);
  });
  page.on("requestfinished", (request) => underWay.delete(request));
  page.on("requestfailed", (request) => underWay.delete(request));
  const quiet = () => until(async () => underWay.size === 0, SERVER);

  await openDesktop(page, base, step);
  const made = [
    await store(page, BEACH),
    await store(page, GARDEN),
    await store(page, HARBOUR, "documents"),
  ];
  try {
    // The page's copy of the drive learns of the uploads from a read.
    await quiet();
    await reloadDesktop(page);
    let window = await openTv(page);
    const stored = async () => (await api(page, "GET", LIBRARY)).json?.library?.homeVideos ?? [];
    const card = (name) => window.locator(".mac-card-grid-card", { hasText: name }).first();

    // ---- Import --------------------------------------------------------------------------------
    await chooseMenu(page, "File", "Import…");
    const panel = page.locator(".mac-tv-panel-layer");
    await panel.waitFor({ timeout: 5_000 });
    await panel.getByText(`${BEACH}.webm`, { exact: true }).first().click();
    await shot(page, path.join(out, "tv-import-panel.png"));
    await panel.getByRole("button", { name: "Open", exact: true }).click();
    await window.getByRole("region", { name: "Home Videos" }).waitFor({ timeout: 5_000 });
    step(
      "File > Import… puts a movie from the drive in Home Videos, kept on the server",
      await until(async () => (await stored())[0]?.id === made[0], SERVER),
      JSON.stringify(await stored()),
    );

    // ---- Play ----------------------------------------------------------------------------------
    await card(BEACH).click();
    const video = window.locator(".mac-tv-player-video video");
    await video.waitFor({ timeout: 5_000 });
    const time = () => video.evaluate((element) => element.currentTime);
    const ran = await until(async () => (await time()) > 1, 15_000);
    await shot(page, path.join(out, "tv-home-video-playing.png"));
    step(
      "The card plays the file in the page, under TV's controller",
      ran &&
        (await video.evaluate((element) => element.src.startsWith("blob:") && !element.paused)) &&
        (await window.getByRole("button", { name: "Add to Watch Later" }).count()) === 0,
      `at ${await time()}`,
    );

    await window.getByRole("button", { name: "Pause", exact: true }).click();
    await until(async () => video.evaluate((element) => element.paused), 3_000);
    const stoppedAt = Math.floor(await time());
    step(
      "Pause in TV's controller pauses it",
      await video.evaluate((element) => element.paused),
      `at ${stoppedAt}`,
    );
    step(
      "The place is kept on the server",
      await until(async () => (await stored())[0]?.place === stoppedAt, SERVER),
      JSON.stringify(await stored()),
    );

    // ---- Show in Finder ------------------------------------------------------------------------
    await chooseMenu(page, "File", "Show in Finder");
    const finder = page.getByRole("region", { name: /^Movies/ }).first();
    const shown = finder.getByRole("option", { name: `${BEACH}.webm`, exact: true }).first();
    await shown.waitFor({ timeout: SERVER });
    step(
      "File > Show in Finder selects the file in its folder",
      await until(async () => (await shown.getAttribute("aria-selected")) === "true", 5_000),
      await shown.getAttribute("aria-selected"),
    );

    // ---- Open With -----------------------------------------------------------------------------
    const garden = finder.getByRole("option", { name: `${GARDEN}.webm`, exact: true }).first();
    await garden.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Open With" }).hover();
    const onTv = page.getByRole("menuitem", { name: "TV", exact: true });
    await onTv.waitFor({ timeout: 5_000 });
    const withMenu = await page.getByRole("menuitem").allInnerTexts();
    await shot(page, path.join(out, "tv-open-with.png"));
    await onTv.click();
    const quicktimeAt = withMenu.findIndex((text) => text.startsWith("QuickTime Player"));
    step(
      "Open With lists TV, after QuickTime Player, which stays the file's default",
      quicktimeAt >= 0 && quicktimeAt < withMenu.findIndex((text) => text.startsWith("TV")),
      withMenu.join(" | ").slice(0, 300),
    );
    await window.getByRole("region", { name: `Playing ${GARDEN}` }).waitFor({ timeout: SERVER });
    const gardenRuns = await until(
      () =>
        window
          .locator("video")
          .first()
          .evaluate((element) => !element.paused && element.currentTime > 0),
      8_000,
    );
    step(
      "Open With TV adds the file and plays it",
      gardenRuns &&
        (await until(async () => (await stored()).some((each) => each.id === made[1]), SERVER)),
      JSON.stringify(await stored()),
    );
    // Its five seconds may have run out meanwhile, which ends the player by itself.
    await window
      .getByRole("button", { name: "Done", exact: true })
      .click({ timeout: 2_000 })
      .catch(() => {});

    // ---- Reload --------------------------------------------------------------------------------
    await quiet();
    await reloadDesktop(page);
    window = await openTv(page);
    await chooseMenu(page, "View", "Library");
    await card(BEACH).waitFor({ timeout: SERVER });
    await page.mouse.move(700, 500);
    await page.waitForTimeout(400);
    step(
      "Over a reload both are there, and the first says where it stopped",
      (await card(GARDEN).count()) === 1 &&
        (await card(BEACH).innerText()).includes(`0:0${stoppedAt}`),
      await card(BEACH).innerText(),
    );
    await shot(page, path.join(out, "tv-home-videos.png"));

    await card(BEACH).click({ button: "right" });
    // Where the video stands at its first frame, before it can play its way to the place.
    await page.evaluate(() => {
      document.addEventListener(
        "playing",
        (event) => {
          window.__firstPlayingAt ??= event.target.currentTime;
        },
        true,
      );
    });
    await page.getByRole("menuitem", { name: `Resume from 0:0${stoppedAt}` }).click();
    const again = window.locator(".mac-tv-player-video video");
    await again.waitFor({ timeout: 5_000 });
    await until(() => page.evaluate(() => window.__firstPlayingAt !== undefined), 10_000);
    const startedAt = await page.evaluate(() => window.__firstPlayingAt);
    step(
      "Resume plays from where it stopped, not from the start",
      startedAt >= stoppedAt && startedAt < stoppedAt + 1,
      `first played at ${startedAt}, stopped at ${stoppedAt}`,
    );
    await chooseMenu(page, "Controls", "Stop");
    await card(BEACH).waitFor({ timeout: 5_000 });

    // ---- A drag from Finder --------------------------------------------------------------------
    await launch(page, "Finder");
    const front = page.locator(".mac-window.mac-finder").first();
    await front.waitFor({ timeout: 5_000 });
    await front.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    const harbour = front.getByRole("option", { name: `${HARBOUR}.webm`, exact: true }).first();
    await harbour.waitFor({ timeout: 5_000 });
    const from = await harbour.boundingBox();
    const frontBox = await front.boundingBox();
    const tvBox = await window.boundingBox();
    // A point of TV's window that Finder's does not cover.
    const to = { x: tvBox.x + tvBox.width - 30, y: tvBox.y + tvBox.height - 30 };
    const covered =
      to.x > frontBox.x &&
      to.x < frontBox.x + frontBox.width &&
      to.y > frontBox.y &&
      to.y < frontBox.y + frontBox.height;
    await page.mouse.move(from.x + 40, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y + from.height / 2 + 10, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    step(
      "A movie dragged from Finder onto the window joins Home Videos",
      !covered &&
        (await until(async () => (await stored()).some((each) => each.id === made[2]), SERVER)),
      `covered ${covered}; ${JSON.stringify(await stored())}`,
    );

    // ---- Remove, and a file gone ---------------------------------------------------------------
    await launch(page, "TV");
    await card(BEACH).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Remove from Library" }).click();
    const kept = (await api(page, "GET", "/api/files/")).json?.entries ?? [];
    step(
      "Remove from Library takes the card and leaves the file in the drive",
      (await until(async () => !(await stored()).some((each) => each.id === made[0]), SERVER)) &&
        kept.some((entry) => entry.id === made[0] && entry.trashed_ms === undefined),
      JSON.stringify(await stored()),
    );

    await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: made[2] }] });
    await quiet();
    await reloadDesktop(page);
    window = await openTv(page);
    // The window's save may come as the drive's change arrives or after the reload: what counts is
    // what the server then holds.
    step(
      "A file deleted for good gives its place in the Library back",
      await until(async () => !(await stored()).some((each) => each.id === made[2]), 2 * SERVER),
      JSON.stringify(await stored()),
    );
  } finally {
    await quiet();
    await api(page, "POST", "/api/files/ops", {
      ops: made.slice(0, 2).map((id) => ({ op: "delete", id })),
    }).catch(() => {});
    await quiet();
  }
});

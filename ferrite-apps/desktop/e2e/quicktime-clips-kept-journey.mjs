#!/usr/bin/env node
// QuickTime Player's clip boundaries on the desktop served by `ferrite dev`: a split marks the movie edited and Undo
// takes that back; rotating, flipping and trimming keep the splits, read from the strip and the picture; Save keeps
// them with the saved movie, and opening that movie after a reload brings them back; Open Recent from a recording
// window that has not started shows the movie. Exits 0 only with every step passed and no console or HTTP error. The
// movie is a WebM recorded in the page, a different colour each two seconds.
//
//   node e2e/quicktime-clips-kept-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("quicktime-clips-kept");
const tag = Date.now().toString(36);
const NAME = `Kept ${tag}.webm`;
const CLIPS = "/api/quicktime-player/clips";
const LIBRARY = "/api/app-store/library";

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

await run(async (page) => {
  await openDesktop(page, base, step);
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes("quicktime-player")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "quicktime-player"],
      rev: held.rev,
    });
  }
  await page.evaluate(async (name) => {
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
    while (performance.now() - started < 6000) {
      const two = Math.floor((performance.now() - started) / 2000);
      context.fillStyle = ["#e01010", "#10c010", "#1010e0"][two] ?? "#1010e0";
      context.fillRect(0, 0, 320, 240);
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
        parent: "documents",
        name,
        size: blob.size,
        type: blob.type,
        existing: "fail",
      }),
    }).then((reply) => reply.json());
    for (let index = 0; index < uploading.pieces; index += 1) {
      const piece = blob.slice(index * uploading.piece_bytes, (index + 1) * uploading.piece_bytes);
      await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: await piece.arrayBuffer(),
      });
    }
    await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    });
  }, NAME);
  await reloadDesktop(page);

  const dock = page.getByRole("toolbar", { name: "Dock" });
  const bar = page.getByRole("menubar").first();
  const row = (name) => page.getByRole("menuitem", { name, exact: true }).first();
  const choose = async (menu, name) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await row(name).click();
    await page.waitForTimeout(200);
  };
  const player = page.locator(".mac-quicktime-player").first();
  const video = player.locator("video");
  const clips = page.locator(".mac-quicktime-player-clip");
  const edited = () => page.getByText(/ — Edited$/).count();
  const openInFinder = async () => {
    await dock.getByRole("button", { name: "Finder" }).click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: 10_000 });
    await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    return finder;
  };
  const loaded = async () => {
    await video.waitFor({ timeout: 20_000 });
    return until(() =>
      video.evaluate(
        (each) => Number.isFinite(each.duration) && each.duration > 3 && each.readyState >= 2,
      ),
    );
  };
  const seekTo = (seconds) =>
    video.evaluate(
      (each, at) =>
        new Promise((resolve) => {
          each.pause();
          each.addEventListener("seeked", () => resolve(), { once: true });
          each.currentTime = at;
        }),
      seconds,
    );
  const finder = await openInFinder();
  await finder.getByRole("option", { name: NAME, exact: true }).first().dblclick();
  await loaded();

  step("a movie just opened is not edited", (await edited()) === 0);
  await choose("View", "Show Clips");
  await seekTo(2);
  await page.waitForTimeout(400);
  await choose("Edit", "Split Clip");
  step("Split Clip leaves two clips", await until(async () => (await clips.count()) === 2));
  step("a split marks the movie edited", await until(async () => (await edited()) === 1, 3_000));
  await choose("Edit", "Undo");
  step("Undo leaves one clip", await until(async () => (await clips.count()) === 1, 3_000));
  step("and the movie no longer edited", await until(async () => (await edited()) === 0, 3_000));
  await choose("Edit", "Redo");
  step(
    "Redo brings the split and the mark back",
    await until(async () => (await clips.count()) === 2 && (await edited()) === 1, 3_000),
  );

  const box = () =>
    video.evaluate((each) => ({ width: each.videoWidth, height: each.videoHeight }));
  await choose("Edit", "Rotate Right");
  const rotated = await until(async () => {
    const now = await box();
    return now.width === 240 && now.height === 320;
  }, 40_000);
  step("Rotate Right turns the picture", Boolean(rotated), JSON.stringify(await box()));
  step("and keeps the two clips", await until(async () => (await clips.count()) === 2, 5_000));
  await choose("Edit", "Flip Horizontal");
  await page.waitForTimeout(500);
  await until(
    () =>
      player
        .locator("[role=progressbar]")
        .count()
        .then((count) => count === 0),
    40_000,
  );
  step(
    "Flip Horizontal keeps them too",
    await until(async () => (await clips.count()) === 2, 40_000),
  );
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "quicktime-clips-kept.png"));

  const fileNow = async () =>
    ((await api(page, "GET", "/api/files/")).json.entries ?? []).find((each) => each.name === NAME);
  const opened = await fileNow();
  await choose("File", "Save");
  const stored = await until(async () => {
    const now = await fileNow();
    return now.version > opened.version ? now : false;
  }, 40_000);
  step(
    "Save writes the movie into its own file",
    stored?.id === opened.id,
    JSON.stringify([opened.version, stored?.version]),
  );
  const kept = await until(async () => {
    const reply = await api(page, "GET", `${CLIPS}/${stored.id}`);
    return reply.json.cuts?.length > 0 ? reply.json : null;
  });
  step(
    "and keeps its split near the two seconds it was made at",
    kept?.cuts.length === 1 && Math.abs(kept.cuts[0] - 2) < 0.5,
    JSON.stringify(kept),
  );
  step("the saved movie is not edited", await until(async () => (await edited()) === 0, 5_000));

  await reloadDesktop(page);
  const finderAgain = await openInFinder();
  await finderAgain.getByRole("option", { name: NAME, exact: true }).first().dblclick();
  await loaded();
  await choose("View", "Show Clips");
  step(
    "after a reload the saved movie opens with its two clips",
    await until(async () => (await clips.count()) === 2),
  );
  step("and is not edited", (await edited()) === 0);
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "quicktime-clips-reopened.png"));

  // While trimming, I and O set the handles at the playhead.
  await choose("Edit", "Trim…");
  const startHandle = page.getByRole("slider", { name: "Trim start" });
  const endHandle = page.getByRole("slider", { name: "Trim end" });
  await startHandle.waitFor({ timeout: 5_000 });
  await seekTo(1);
  await page.waitForTimeout(400);
  await page.keyboard.press("i");
  step(
    "I sets the trim's start at the playhead",
    await until(async () => (await startHandle.getAttribute("aria-valuenow")) === "1", 3_000),
  );
  await seekTo(4);
  await page.waitForTimeout(400);
  await page.keyboard.press("o");
  step(
    "O sets its end at the playhead",
    await until(async () => (await endHandle.getAttribute("aria-valuenow")) === "4", 3_000),
  );
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "quicktime-trim-marks.png"));
  await page.getByRole("button", { name: "Cancel", exact: true }).first().click();

  // File > Revert To > Last Saved, which Undo takes back.
  const savedShape = await box();
  await choose("Edit", "Rotate Right");
  step(
    "a rotation turns the saved movie and marks it edited",
    await until(async () => {
      const now = await box();
      return now.width === savedShape.height && (await edited()) === 1;
    }, 40_000),
  );
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await row("Revert To").hover();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "quicktime-revert-to.png"));
  await row("Last Saved").click();
  step(
    "Revert To > Last Saved brings the saved picture back, not edited",
    await until(async () => {
      const now = await box();
      return now.width === savedShape.width && (await edited()) === 0;
    }),
  );
  await choose("Edit", "Undo");
  step(
    "and Undo takes the revert back",
    await until(async () => {
      const now = await box();
      return now.width === savedShape.height && (await edited()) === 1;
    }),
  );
  await choose("Edit", "Redo");
  await until(async () => (await edited()) === 0);
  // Saved in this window: Last Saved is that save, not the file as it was opened.
  await choose("Edit", "Rotate Right");
  await until(async () => (await edited()) === 1, 40_000);
  await choose("File", "Save");
  step(
    "Save leaves the turned movie not edited",
    await until(async () => {
      const now = await box();
      return now.width === savedShape.height && (await edited()) === 0;
    }, 40_000),
  );
  await choose("Edit", "Rotate Right");
  await until(async () => (await edited()) === 1, 40_000);
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await row("Revert To").hover();
  await page.waitForTimeout(300);
  await row("Last Saved").click();
  step(
    "Last Saved after a save goes back to that save, not to the movie as opened",
    await until(async () => {
      const now = await box();
      return now.width === savedShape.height && (await edited()) === 0;
    }),
  );
  // Open Recent from a recording window that has not started.
  await choose("File", "New Audio Recording");
  await page
    .getByRole("button", { name: /record/i })
    .first()
    .waitFor({ timeout: 15_000 });
  const gone = await until(async () => (await video.count()) === 0, 5_000);
  step("New Audio Recording leaves the movie for a recording window", Boolean(gone));
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await row("Open Recent").hover();
  await page.getByRole("menuitem", { name: NAME, exact: true }).first().click();
  step("Open Recent from it shows the movie", Boolean(await until(() => loaded(), 20_000)));
});

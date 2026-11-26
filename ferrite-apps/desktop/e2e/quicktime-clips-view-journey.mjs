#!/usr/bin/env node
// QuickTime Player's View menu rows on the desktop served by `ferrite dev`: in a window Fill Screen,
// Panoramic and the subtitle rows are dimmed with their reasons; in full screen Fit, Fill and Panoramic
// lay the picture out as read from the page's own pixels; Play All Movies plays; Show Clips shows the
// strip, Split Clip at the playhead leaves two clips with their own stills, a clip moves the playhead,
// and Undo goes back over a split. Exits 0 only with every step passed and no console or HTTP error.
// The movie is a WebM recorded in the page: 640 by 480, eight upright bars under a white band.
//
//   node e2e/quicktime-clips-view-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("quicktime-clips-view");
const NAME = `Bars ${Date.now().toString(36)}.webm`;
const LIBRARY = "/api/app-store/library";
const BARS = [
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#ff00ff",
  "#00ffff",
  "#ff8000",
  "#8000ff",
];
const rgb = (hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
const near = (a, b, by = 70) => [0, 1, 2].every((index) => Math.abs(a[index] - b[index]) < by);
const dark = (a) => a[0] < 40 && a[1] < 40 && a[2] < 40;

async function until(check, ms = 8_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** A row of the page as a screenshot shows it: `[r, g, b]` for each pixel, read from its PNG. */
const pixels = async (page, points) => {
  const png = (await page.screenshot({ timeout: 15_000 })).toString("base64");
  return page.evaluate(
    async ({ png, points }) => {
      const bytes = Uint8Array.from(atob(png), (each) => each.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      return points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data].slice(0, 3));
    },
    { png, points },
  );
};

await run(async (page) => {
  let made = null;
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
    made = await page.evaluate(
      async ({ name, bars }) => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d");
        const recorder = new MediaRecorder(canvas.captureStream(15), {
          mimeType: "video/webm",
          videoBitsPerSecond: 4_000_000,
        });
        const parts = [];
        recorder.ondataavailable = (event) => parts.push(event.data);
        const stopped = new Promise((resolve) => {
          recorder.onstop = resolve;
        });
        recorder.start();
        const started = performance.now();
        while (performance.now() - started < 6000) {
          const second = Math.floor((performance.now() - started) / 1000);
          bars.forEach((bar, index) => {
            context.fillStyle = bar;
            context.fillRect(index * 80, 0, 80, 480);
          });
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, 640, 20);
          // A square that moves each second tells the clips' stills apart.
          context.fillStyle = "#000000";
          context.fillRect(second * 80, 400, 80, 80);
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
      { name: NAME, bars: BARS },
    );
    await reloadDesktop(page);
    const dock = page.getByRole("toolbar", { name: "Dock" });
    await dock.waitFor({ timeout: 30_000 });
    await dock.getByRole("button", { name: "Finder" }).click();
    const finder = page.locator(".mac-window.mac-finder").first();
    await finder.waitFor({ timeout: 10_000 });
    await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
    await finder.getByRole("option", { name: NAME, exact: true }).first().dblclick();
    const player = page.locator(".mac-quicktime-player").first();
    const video = player.locator("video");
    await video.waitFor({ timeout: 20_000 });
    await until(() =>
      video.evaluate((each) => Number.isFinite(each.duration) && each.duration > 3),
    );

    const bar = page.getByRole("menubar").first();
    const openView = () => bar.getByRole("menuitem", { name: "View", exact: true }).click();
    const viewRow = (name) => page.getByRole("menuitem", { name, exact: true }).first();
    const choose = async (menu, name) => {
      await bar.getByRole("menuitem", { name: menu, exact: true }).click();
      await viewRow(name).click();
      await page.waitForTimeout(200);
    };

    // In a window.
    await openView();
    await page.waitForTimeout(200);
    for (const name of ["Fill Screen", "Panoramic"]) {
      const row = viewRow(name);
      step(
        `${name} is dimmed in a window, saying why`,
        (await row.getAttribute("aria-disabled")) === "true" &&
          /full screen/.test((await row.getAttribute("data-reason")) ?? "") &&
          (await row.getAttribute("title")) === (await row.getAttribute("data-reason")),
      );
    }
    for (const name of ["Show Subtitles", "Languages"]) {
      const row = viewRow(name);
      step(
        `${name} is dimmed, saying why`,
        (await row.getAttribute("aria-disabled")) === "true" &&
          /subtitles or languages inside a movie file/.test(
            (await row.getAttribute("data-reason")) ?? "",
          ),
      );
    }
    await shot(page, path.join(out, "quicktime-view-rows.png"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Play All Movies.
    await choose("View", "Play All Movies");
    const playing = await until(() =>
      video.evaluate((each) => !each.paused && each.currentTime > 0.1),
    );
    step("Play All Movies plays the movie that is open", Boolean(playing));
    await player.hover();
    await player.getByRole("button", { name: "Pause", exact: true }).click();

    // Clips.
    const strip = player
      .getByRole("region", { name: "Clips" })
      .or(player.locator(".mac-quicktime-player-clips"))
      .first();
    const clips = strip.locator(".mac-quicktime-player-clip");
    const seekTo = (seconds) =>
      video.evaluate(async (each, at) => {
        each.currentTime = at;
        await new Promise((done) => each.addEventListener("seeked", done, { once: true }));
      }, seconds);
    await seekTo(2);
    await page.waitForTimeout(300);
    await choose("View", "Show Clips");
    await strip.waitFor({ timeout: 5_000 });
    step("Show Clips shows one clip for a whole movie", (await clips.count()) === 1);
    const stills = () => clips.evaluateAll((all) => all.map((each) => each.style.backgroundImage));
    const oneStill = await until(async () => (await stills())[0]?.startsWith("url("));
    step("the clip shows a still of the movie", Boolean(oneStill));
    await openView();
    await viewRow("Hide Clips")
      .waitFor({ timeout: 3_000 })
      .catch(() => {});
    step("the row now reads Hide Clips", (await viewRow("Hide Clips").count()) === 1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");

    await choose("Edit", "Split Clip");
    step("Split Clip leaves two clips", await until(async () => (await clips.count()) === 2));
    const labels = await clips.evaluateAll((all) =>
      all.map((each) => each.getAttribute("aria-label")),
    );
    const seconds = (await video.evaluate((each) => each.currentTime)).toFixed(0);
    step(
      "they meet at the playhead",
      labels[0]?.includes(`to 0:0${seconds}`) && labels[1]?.includes(`0:0${seconds} to`),
      JSON.stringify(labels),
    );
    const widths = await clips.evaluateAll((all) => all.map((each) => each.offsetWidth));
    const length = await video.evaluate((each) => each.duration);
    const expected = (widths[0] + widths[1]) * (2 / length);
    step(
      "each clip is as wide as it is long",
      Math.abs(widths[0] - expected) < 6,
      JSON.stringify({ widths, expected }),
    );
    const twoStills = await until(async () => {
      const now = await stills();
      return now.length === 2 && now.every((each) => each.startsWith("url(")) && now[0] !== now[1];
    });
    step("each clip has a still of its own", Boolean(twoStills));

    await clips.nth(0).click();
    const atStart = await until(
      async () => (await video.evaluate((each) => each.currentTime)) < 0.2,
    );
    step("choosing the first clip takes the playhead to its start", Boolean(atStart));
    step("the chosen clip is marked", (await clips.nth(0).getAttribute("aria-pressed")) === "true");
    await clips.nth(1).click();
    const atSecond = await until(
      async () => Math.abs((await video.evaluate((each) => each.currentTime)) - 2) < 0.3,
    );
    step("choosing the second clip takes it to the cut", Boolean(atSecond));

    const srcBefore = await video.getAttribute("src");
    await player.focus();
    await page.keyboard.press("ControlOrMeta+z");
    step("Undo goes back to one clip", await until(async () => (await clips.count()) === 1));
    step("without reloading the movie", (await video.getAttribute("src")) === srcBefore);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    step("Redo splits it again", await until(async () => (await clips.count()) === 2));
    await seekTo(4);
    await page.waitForTimeout(300);
    await player.focus();
    await page.keyboard.press("ControlOrMeta+y");
    step("Command-Y splits at the new place", await until(async () => (await clips.count()) === 3));
    await page.mouse.move(350, 300);
    await page.waitForTimeout(500);
    await shot(page, path.join(out, "quicktime-clips-split.png"));
    await page.keyboard.press("ControlOrMeta+e");
    step("Command-E hides the strip", await until(async () => (await strip.count()) === 0));
    await page.keyboard.press("ControlOrMeta+e");
    step(
      "the splits are still there when it shows again",
      await until(async () => (await clips.count()) === 3),
    );
    await strip.getByRole("button", { name: "Done", exact: true }).click();
    step("Done closes it", await until(async () => (await strip.count()) === 0));

    // Full screen: the window takes the page, a shape the movie's is not.
    await seekTo(0.5);
    await page.mouse.move(5, 300);
    await openView();
    const fullRows = page.getByRole("menuitem", { name: "Enter Full Screen", exact: true });
    await fullRows.first().waitFor({ timeout: 3_000 });
    step("the View menu has one Enter Full Screen row", (await fullRows.count()) === 1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await choose("View", "Enter Full Screen");
    const page1 = await until(async () => {
      const box = await player.boundingBox();
      return box?.width === 1440 && box?.height === 900;
    });
    step(
      "Enter Full Screen fills the page",
      Boolean(page1),
      JSON.stringify(await player.boundingBox()),
    );
    await page.waitForTimeout(600);

    const MID = 450;
    const row = (y) => Array.from({ length: 144 }, (_, index) => [index * 10 + 5, y]);
    /** The bars seen along the row: for each, the x where it starts. */
    const barStarts = async (y) => {
      const colours = await pixels(page, row(y));
      return BARS.map((each) => {
        const at = colours.findIndex((colour) => near(colour, rgb(each)));
        return at < 0 ? -1 : at * 10;
      });
    };

    const fit = await pixels(page, [
      [20, MID],
      [1420, MID],
      [720, 30],
    ]);
    step(
      "Fit leaves black at the sides and shows the white band",
      dark(fit[0]) && dark(fit[1]) && near(fit[2], [255, 255, 255]),
      JSON.stringify(fit),
    );
    await shot(page, path.join(out, "quicktime-scale-fit.png"));

    await player.focus();
    await page.keyboard.press("ControlOrMeta+4");
    await page.waitForTimeout(300);
    await page.mouse.move(720, 300);
    const fill = await pixels(page, [
      [20, MID],
      [1420, MID],
      [720, 30],
    ]);
    step(
      "Fill Screen covers the sides and crops the band off the top",
      near(fill[0], rgb(BARS[0])) &&
        near(fill[1], rgb(BARS[7])) &&
        !near(fill[2], [255, 255, 255], 40),
      JSON.stringify(fill),
    );
    await page.waitForTimeout(300);
    await shot(page, path.join(out, "quicktime-scale-fill.png"));
    const fillStarts = await barStarts(MID);
    step(
      "its bars are all one width",
      Math.abs(fillStarts[4] - fillStarts[3] - 180) <= 10 &&
        Math.abs(fillStarts[7] - fillStarts[6] - 180) <= 10,
      JSON.stringify(fillStarts),
    );

    await page.keyboard.press("ControlOrMeta+5");
    await page.waitForTimeout(400);
    const panoramic = await pixels(page, [
      [5, MID],
      [1435, MID],
      [720, 30],
    ]);
    step(
      "Panoramic reaches both edges and keeps the band on top",
      near(panoramic[0], rgb(BARS[0])) &&
        near(panoramic[1], rgb(BARS[7])) &&
        near(panoramic[2], [255, 255, 255]),
      JSON.stringify(panoramic),
    );
    const starts = await barStarts(MID);
    const middle = starts[4] - starts[3];
    const outer = starts[1] - starts[0];
    step(
      "Panoramic keeps the centre's true shape and stretches the ends",
      Math.abs(middle - 152) <= 12 && outer > middle * 1.25,
      JSON.stringify({ starts, middle, outer }),
    );
    await page.waitForTimeout(300);
    await shot(page, path.join(out, "quicktime-scale-panoramic.png"));

    await page.keyboard.press("ControlOrMeta+3");
    await page.waitForTimeout(300);
    const back = await pixels(page, [
      [20, MID],
      [720, 30],
    ]);
    step(
      "Fit to Screen gives the whole picture back",
      dark(back[0]) && near(back[1], [255, 255, 255]),
      JSON.stringify(back),
    );

    // The rows of the menu, in full screen, where the menu bar comes back at the top of the page.
    await page.mouse.move(720, 0);
    await page.waitForTimeout(400);
    await choose("View", "Fill Screen");
    const filled = await pixels(page, [[20, MID]]);
    step(
      "the Fill Screen row does what its key does",
      near(filled[0], rgb(BARS[0])),
      JSON.stringify(filled),
    );
    await page.mouse.move(720, 0);
    await page.waitForTimeout(400);
    await choose("View", "Exit Full Screen");
    await until(async () => (await player.boundingBox())?.width !== 1440);
    await page.waitForTimeout(400);
    const box = await player.boundingBox();
    step(
      "out of full screen the window takes the movie's shape again",
      Math.abs(box.width / box.height - 4 / 3) < 0.02,
      JSON.stringify(box),
    );
    step(
      "and the picture is laid out whole",
      (await player.locator(".mac-quicktime-player-movie").getAttribute("data-scaling")) === "fit",
    );
  } finally {
    if (made) {
      await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id: made }] }).catch(
        () => {},
      );
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

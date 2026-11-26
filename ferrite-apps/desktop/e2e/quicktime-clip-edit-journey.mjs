#!/usr/bin/env node
// QuickTime Player's clip editing on the desktop served by `ferrite dev`: Edit > Cut, Copy, Paste and
// Delete on a chosen clip, a clip dragged to another place in the strip, Edit > Add Clip to End…, then View
// > Float on Top, the picture's contextual menu and File > Move To…. After every clip edit the movie the
// window plays is read colour by colour from the element's own pixels, Play All Movies is watched playing
// that order, and an export and a saved movie are read back from the drive. Exits 0 only with every step
// passed and no console or HTTP error. The movies are WebMs recorded in the page: the main one shows one
// flat colour for each of its six seconds, so a read of the picture says which second it came from.
//
//   node e2e/quicktime-clip-edit-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const { base, out } = options();
const { step, run } = journey("quicktime-clip-edit");
const stamp = Date.now().toString(36);
const NAME = `Seconds ${stamp}.webm`;
const EXTRA = `Extra ${stamp}.webm`;
// What the player names a copy of NAME: "Harbour.webm" exported at 480p is "Harbour 480p.webm". Only these exact names,
// which hold this run's stamp, are ever taken for this run's files: anything else on the drive is the person's.
const copyNamed = (suffix) => [`Seconds ${stamp} ${suffix}.webm`, `Seconds ${stamp} ${suffix}.mp4`];
const LIBRARY = "/api/app-store/library";
const COLOURS = {
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  magenta: [255, 0, 255],
  cyan: [0, 255, 255],
  white: [255, 255, 255],
  black: [0, 0, 0],
};
const SECONDS = ["red", "green", "blue", "yellow", "magenta", "cyan"];
const nameOf = (pixel) =>
  Object.entries(COLOURS).find(([, each]) =>
    each.every((value, index) => Math.abs(value - pixel[index]) < 80),
  )?.[0] ?? `rgb(${pixel.join()})`;

async function until(check, ms = 60_000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check().catch(() => false);
    if (value) return value;
    if (Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/** Records `colours` a second each at the size given, into the folder given; answers the file's id. */
const makeMovie = (page, { name, colours, width, height, parent }) =>
  page.evaluate(
    async ({ name, colours, width, height, parent }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      const recorder = new MediaRecorder(canvas.captureStream(20), {
        mimeType: "video/webm",
        videoBitsPerSecond: 2_000_000,
      });
      const parts = [];
      recorder.ondataavailable = (event) => parts.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.start();
      const started = performance.now();
      while (performance.now() - started < colours.length * 1000) {
        const at = Math.floor((performance.now() - started) / 1000);
        const [r, g, b] = colours[Math.min(at, colours.length - 1)];
        context.fillStyle = `rgb(${r},${g},${b})`;
        context.fillRect(0, 0, width, height);
        // A corner that changes makes every frame a new one for the recorder.
        context.fillStyle = `rgb(${Math.floor(performance.now() % 7)},0,0)`;
        context.fillRect(0, 0, 2, 2);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      recorder.stop();
      await stopped;
      const blob = new Blob(parts, { type: "video/webm" });
      const json = { "content-type": "application/json" };
      const uploading = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({ parent, name, size: blob.size, type: blob.type, existing: "fail" }),
      }).then((reply) => reply.json());
      for (let index = 0; index < uploading.pieces; index += 1) {
        await fetch(`/api/files/uploads/${uploading.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: await blob
            .slice(index * uploading.piece_bytes, (index + 1) * uploading.piece_bytes)
            .arrayBuffer(),
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
    { name, colours, width, height, parent },
  );

/** A video's length, and the colour at the middle of its picture a little after each of `times`. */
const readVideo = (video, times) =>
  video.evaluate(async (element, times) => {
    if (element.readyState < 1) {
      await new Promise((done) => element.addEventListener("loadedmetadata", done, { once: true }));
    }
    const seek = (seconds) =>
      new Promise((done) => {
        element.addEventListener("seeked", done, { once: true });
        element.currentTime = seconds;
      });
    if (!Number.isFinite(element.duration)) await seek(Number.MAX_SAFE_INTEGER);
    const length = element.duration;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const colours = [];
    for (const at of times) {
      await seek(at);
      context.drawImage(element, 0, 0);
      colours.push(
        [...context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data].slice(0, 3),
      );
    }
    await seek(0.3);
    return { length, colours, width: element.videoWidth, height: element.videoHeight };
  }, times);

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
      await makeMovie(page, {
        name: NAME,
        colours: SECONDS.map((each) => COLOURS[each]),
        width: 640,
        height: 480,
        parent: "documents",
      }),
    );
    // Another shape, to show it whole on the main movie's size.
    made.push(
      await makeMovie(page, {
        name: EXTRA,
        colours: [COLOURS.white, COLOURS.white],
        width: 240,
        height: 480,
        parent: "movies",
      }),
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
    const row = (name) => page.getByRole("menuitem", { name, exact: true }).first();
    const openMenu = async (menu) => {
      await bar.getByRole("menuitem", { name: menu, exact: true }).click();
      await page.waitForTimeout(200);
    };
    const closeMenu = async () => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
    };
    const choose = async (menu, name) => {
      await openMenu(menu);
      await row(name).click();
      await page.waitForTimeout(200);
    };
    const strip = player.locator(".mac-quicktime-player-clips");
    const clips = strip.locator(".mac-quicktime-player-clip");
    const seekTo = (seconds) =>
      video.evaluate(async (each, at) => {
        each.currentTime = at;
        await new Promise((done) => each.addEventListener("seeked", done, { once: true }));
      }, seconds);
    const srcNow = () => video.getAttribute("src");
    /** Waits for the replay that gives the window a new movie, and for that movie to have a length. */
    const replayed = async (before) => {
      const changed = await until(async () => (await srcNow()) !== before, 40_000);
      await until(
        () => video.evaluate((each) => Number.isFinite(each.duration) && each.duration > 0),
        15_000,
      );
      await page.waitForTimeout(300);
      return Boolean(changed);
    };
    /** The window's movie as a list of colour names, read one second apart, with its length. */
    const movieOrder = async (seconds) => {
      const read = await readVideo(
        video,
        Array.from({ length: seconds }, (_, index) => index + 0.5),
      );
      return { ...read, names: read.colours.map(nameOf) };
    };
    const near = (length, expected) => Math.abs(length - expected) < 0.6;
    const sameOrder = (names, expected) => names.join() === expected.join();

    // Three clips of two seconds each: red green, blue yellow, magenta cyan.
    await seekTo(2);
    await page.waitForTimeout(300);
    await choose("Edit", "Split Clip");
    await seekTo(4);
    await page.waitForTimeout(300);
    await choose("Edit", "Split Clip");
    step("two splits leave three clips", await until(async () => (await clips.count()) === 3));

    await openMenu("Edit");
    for (const name of ["Cut", "Copy", "Delete"]) {
      step(
        `${name} is dimmed with no clip chosen, saying why`,
        (await row(name).getAttribute("aria-disabled")) === "true" &&
          /Choose a clip/.test((await row(name).getAttribute("data-reason")) ?? ""),
      );
    }
    step(
      "Paste is dimmed with nothing copied",
      (await row("Paste").getAttribute("aria-disabled")) === "true",
    );
    await closeMenu();

    // Delete: the middle clip goes.
    await clips.nth(1).click();
    step(
      "choosing a clip marks it and moves the playhead to it",
      (await clips.nth(1).getAttribute("aria-pressed")) === "true" &&
        (await until(async () => Math.abs((await video.evaluate((v) => v.currentTime)) - 2) < 0.3)),
    );
    let before = await srcNow();
    await choose("Edit", "Delete");
    await shot(page, path.join(out, "quicktime-clip-delete-progress.png"));
    step("Delete replays the movie", await replayed(before));
    let order = await movieOrder(4);
    step(
      "Delete leaves the movie without that clip's seconds, read from its pixels",
      sameOrder(order.names, ["red", "green", "magenta", "cyan"]) && near(order.length, 4),
      JSON.stringify(order),
    );
    step("and two clips in the strip", await until(async () => (await clips.count()) === 2));
    step("the title says it has changes", (await page.getByText(`${NAME} — Edited`).count()) > 0);
    await page.mouse.move(350, 300);
    await page.waitForTimeout(500);
    await shot(page, path.join(out, "quicktime-clip-delete.png"));

    // Undo brings the middle clip back.
    before = await srcNow();
    await player.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await replayed(before);
    await until(async () => (await clips.count()) === 3);
    order = await movieOrder(6);
    step(
      "Undo gives the deleted clip back",
      sameOrder(order.names, SECONDS) && (await clips.count()) === 3,
      JSON.stringify(order.names),
    );

    // Cut and Paste: the first clip goes after the last one.
    await clips.nth(0).click();
    before = await srcNow();
    await page.keyboard.press("ControlOrMeta+x");
    step("Command-X replays the movie", await replayed(before));
    order = await movieOrder(4);
    step(
      "Cut takes the clip out",
      sameOrder(order.names, ["blue", "yellow", "magenta", "cyan"]),
      JSON.stringify(order.names),
    );
    await until(async () => (await clips.count()) === 2);
    await clips.nth(1).click();
    before = await srcNow();
    await choose("Edit", "Paste");
    step("Paste replays the movie", await replayed(before));
    order = await movieOrder(6);
    step(
      "Paste puts the cut clip after the chosen one",
      sameOrder(order.names, ["blue", "yellow", "magenta", "cyan", "red", "green"]) &&
        near(order.length, 6),
      JSON.stringify(order),
    );
    await page.mouse.move(350, 300);
    await page.waitForTimeout(400);
    await shot(page, path.join(out, "quicktime-clip-paste.png"));

    // Copy and Paste: the copy leaves the source as it is.
    await until(async () => (await clips.count()) === 3);
    await clips.nth(2).click();
    before = await srcNow();
    await page.keyboard.press("ControlOrMeta+c");
    await page.waitForTimeout(200);
    step("Copy changes nothing in the movie", (await srcNow()) === before);
    await page.keyboard.press("ControlOrMeta+v");
    step("Command-V replays the movie", await replayed(before));
    order = await movieOrder(8);
    step(
      "the copied clip is in the movie twice",
      sameOrder(order.names, ["blue", "yellow", "magenta", "cyan", "red", "green", "red", "green"]),
      JSON.stringify(order.names),
    );
    await page.mouse.move(350, 300);
    await page.waitForTimeout(400);
    await shot(page, path.join(out, "quicktime-clip-copy.png"));
    step(
      "Delete on the key leaves one of them",
      await (async () => {
        await until(async () => (await clips.count()) === 4);
        await clips.nth(3).click();
        before = await srcNow();
        await page.keyboard.press("Delete");
        return replayed(before);
      })(),
    );
    order = await movieOrder(6);
    step(
      "and the movie is what it was",
      sameOrder(order.names, ["blue", "yellow", "magenta", "cyan", "red", "green"]),
      JSON.stringify(order.names),
    );

    // Reorder: the first clip dragged to the end.
    await until(async () => (await clips.count()) === 3);
    await page.mouse.move(350, 300);
    await page.waitForTimeout(200);
    const first = await clips.nth(0).boundingBox();
    const last = await clips.nth(2).boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + first.width, first.y + first.height / 2, { steps: 4 });
    await page.mouse.move(last.x + last.width - 2, first.y + first.height / 2, { steps: 6 });
    await page.waitForTimeout(200);
    step(
      "dragging shows where the clip will go",
      await strip.locator(".mac-quicktime-player-clips-gap").isVisible(),
    );
    await shot(page, path.join(out, "quicktime-clip-reorder-drag.png"));
    before = await srcNow();
    await page.mouse.up();
    step("dropping the clip replays the movie", await replayed(before));
    order = await movieOrder(6);
    const reordered = ["magenta", "cyan", "red", "green", "blue", "yellow"];
    step(
      "the movie plays the clips in their new order, read from its pixels",
      sameOrder(order.names, reordered) && near(order.length, 6),
      JSON.stringify(order),
    );

    // What the strip shows of a replayed movie: its stills, and the picture a chosen clip shows.
    await until(async () => (await clips.count()) === 3);
    const readStills = () =>
      clips.evaluateAll((all) =>
        Promise.all(
          all.map(async (each) => {
            const source = /url\("?(.+?)"?\)/.exec(each.style.backgroundImage)?.[1];
            if (!source) return null;
            const image = new Image();
            image.src = source;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            return [...context.getImageData(image.width / 2, image.height / 2, 1, 1).data].slice(
              0,
              3,
            );
          }),
        ),
      );
    const stillNames = await until(async () => {
      const read = await readStills();
      return read.every(Boolean) ? read.map(nameOf) : false;
    }, 10_000);
    step(
      "each clip's still is its own first colour",
      sameOrder(stillNames || [], ["magenta", "red", "blue"]),
      JSON.stringify(stillNames),
    );
    const pictureNow = () =>
      video.evaluate((element) => {
        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext("2d");
        context.drawImage(element, 0, 0);
        return [...context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data].slice(
          0,
          3,
        );
      });
    await clips.nth(2).click();
    await page.waitForTimeout(500);
    const thirdStart = await video.evaluate((element) => element.currentTime);
    await seekTo(thirdStart + 0.3);
    await page.waitForTimeout(300);
    const atThird = nameOf(await pictureNow());
    await clips.nth(0).click();
    await page.waitForTimeout(500);
    const firstStart = await video.evaluate((element) => element.currentTime);
    await seekTo(0.3);
    await page.waitForTimeout(300);
    const atFirst = nameOf(await pictureNow());
    step(
      "choosing a clip goes to its start, and its first colour is there",
      firstStart < 0.05 &&
        thirdStart > 3.8 &&
        thirdStart < 4.2 &&
        atThird === "blue" &&
        atFirst === "magenta",
      `${thirdStart} ${firstStart} ${atThird} ${atFirst}`,
    );

    await page.mouse.move(350, 300);
    await page.waitForTimeout(400);
    await shot(page, path.join(out, "quicktime-clip-reorder.png"));

    // Play All Movies plays that order, watched as it plays.
    await seekTo(0);
    await page.waitForTimeout(500);
    await choose("View", "Play All Movies");
    const watched = await video.evaluate(async (element) => {
      const canvas = document.createElement("canvas");
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const seen = [];
      const started = performance.now();
      while (performance.now() - started < 9000) {
        if (!element.paused && element.currentTime > 0) {
          context.drawImage(element, 0, 0);
          seen.push(
            [...context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data].slice(0, 3),
          );
        }
        if (element.ended) break;
        await new Promise((done) => setTimeout(done, 100));
      }
      return seen;
    });
    // A replay holds the frame before a clip's start for up to 0.15 s (see CLIP_INSET): a colour counts
    // once two samples, 0.1 s apart, have seen it.
    const played = watched
      .map(nameOf)
      .filter((name, index, all) => all[index + 1] === name || all[index - 1] === name)
      .filter((name, index, all) => index === 0 || all[index - 1] !== name)
      .filter((name) => SECONDS.includes(name));
    step(
      "Play All Movies plays the clips in that order",
      sameOrder(played, reordered),
      JSON.stringify(played),
    );

    // A split leaves no clip chosen: its place in the strip now names another clip.
    await clips.nth(2).click();
    await page.waitForTimeout(300);
    await seekTo(0.7);
    await page.waitForTimeout(300);
    await choose("Edit", "Split Clip");
    await until(async () => (await clips.count()) === 4);
    await openMenu("Edit");
    step(
      "Split Clip with a clip chosen leaves none chosen, so Delete has nothing to take",
      (await row("Delete").getAttribute("aria-disabled")) === "true",
    );
    await page.keyboard.press("Escape");
    await player.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await until(async () => (await clips.count()) === 3);

    // Add Clip to End…: another movie, of another shape, from Movies.
    await seekTo(0);
    await choose("Edit", "Add Clip to End…");
    const chooser = page.getByRole("alertdialog").filter({ hasText: "Add Clip to End" });
    await chooser.waitFor({ timeout: 5_000 });
    await chooser.getByRole("option", { name: EXTRA, exact: true }).waitFor({ timeout: 10_000 });
    step(
      "the dialog does not offer the movie itself",
      (await chooser.getByRole("option", { name: NAME, exact: true }).count()) === 0,
    );
    await chooser.getByRole("option", { name: EXTRA, exact: true }).click();
    await page.waitForTimeout(200);
    await shot(page, path.join(out, "quicktime-clip-add-dialog.png"));
    before = await srcNow();
    await chooser.getByRole("button", { name: "Add", exact: true }).click();
    step("adding a clip replays the movie", await replayed(before));
    order = await movieOrder(8);
    step(
      "the added movie plays after the rest",
      sameOrder(order.names, [...reordered, "white", "white"]) && near(order.length, 8),
      JSON.stringify(order),
    );
    step(
      "keeping the movie's size",
      order.width === 640 && order.height === 480,
      `${order.width} by ${order.height}`,
    );
    const edge = await video.evaluate(async (element) => {
      await new Promise((done) => {
        element.addEventListener("seeked", done, { once: true });
        element.currentTime = 7;
      });
      const canvas = document.createElement("canvas");
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(element, 0, 0);
      const data = (x) => [...context.getImageData(x, 240, 1, 1).data].slice(0, 3);
      return { side: data(40), middle: data(320) };
    });
    step(
      "and showing the taller clip whole on black",
      nameOf(edge.side) === "black" && nameOf(edge.middle) === "white",
      JSON.stringify(edge),
    );
    step("the strip shows it as a clip", await until(async () => (await clips.count()) === 4));
    await page.mouse.move(350, 300);
    await page.waitForTimeout(400);
    await shot(page, path.join(out, "quicktime-clip-added.png"));

    // Export plays what the edits left: read back from the drive.
    await choose("File", "Export As");
    await row("480p").click();
    const driveNow = async () => (await api(page, "GET", "/api/files/")).json;
    const exported = await until(async () => {
      const drive = await driveNow();
      return drive.entries.find(
        (each) => copyNamed("480p").includes(each.name) && each.parent === "movies",
      );
    }, 40_000);
    step("Export As 480p leaves a file in Movies", Boolean(exported), exported?.name);
    if (exported) made.push(exported.id);
    const read = await page.evaluate(async (id) => {
      const bytes = await fetch(`/api/files/content/${id}`, { credentials: "same-origin" }).then(
        (reply) => reply.blob(),
      );
      const element = document.createElement("video");
      element.id = "exported-for-the-journey";
      element.muted = true;
      element.src = URL.createObjectURL(bytes);
      element.style.display = "none";
      document.body.append(element);
      return bytes.size;
    }, exported?.id);
    const file = await readVideo(
      page.locator("#exported-for-the-journey"),
      [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
    );
    await page.evaluate(() => document.getElementById("exported-for-the-journey")?.remove());
    step(
      "the exported file holds the clips in the edited order",
      sameOrder(file.colours.map(nameOf), [...reordered, "white"]) && read > 0,
      JSON.stringify(file.colours.map(nameOf)),
    );

    // Saving the edits into the movie's own file, the one File > Move To… then moves.
    before = await srcNow();
    const fileOfMovie = async () => (await driveNow()).entries.find((each) => each.id === made[0]);
    const opened = await fileOfMovie();
    await player.focus();
    await page.keyboard.press("ControlOrMeta+s");
    const saved = await until(async () => {
      const now = await fileOfMovie();
      return now?.version > opened?.version ? now : false;
    }, 20_000);
    step(
      "Save writes the edited movie into its own file",
      saved?.name === NAME,
      JSON.stringify([opened?.version, saved?.version]),
    );
    await until(async () => !(await page.getByText(/Saving/).count()), 10_000);

    // File > Move To…: it goes to Movies, read back from the drive.
    await choose("File", "Move To…");
    const moveDialog = page.getByRole("alertdialog").filter({ hasText: "Move To" });
    await moveDialog.waitFor({ timeout: 5_000 });
    await moveDialog.getByRole("option", { name: "Movies", exact: true }).click();
    await page.waitForTimeout(200);
    await shot(page, path.join(out, "quicktime-move-to-dialog.png"));
    await moveDialog.getByRole("button", { name: "Move", exact: true }).click();
    const moved = await until(async () => {
      const drive = await driveNow();
      return drive.entries.find((each) => each.id === saved?.id && each.parent === "movies");
    }, 10_000);
    step("Move To puts the file in Movies, read back from the drive", Boolean(moved));
    await player
      .getByText(/is in Movies/)
      .waitFor({ timeout: 5_000 })
      .catch(() => {});
    step("and says so", (await player.getByText(/is in Movies/).count()) === 1);
    await page.mouse.move(350, 300);
    await shot(page, path.join(out, "quicktime-move-to.png"));

    // Float on Top, with Finder overlapping the window.
    const frame = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
    const overlap = async () => {
      const a = await frame.boundingBox();
      const b = await page.locator(".mac-window.mac-finder").first().boundingBox();
      const left = Math.max(a.x, b.x);
      const top = Math.max(a.y, b.y);
      const right = Math.min(a.x + a.width, b.x + b.width);
      const bottom = Math.min(a.y + a.height, b.y + b.height);
      return right > left && bottom > top ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null;
    };
    const onTopAt = (point) =>
      page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return element?.closest(".mac-quicktime-player")
          ? "quicktime"
          : element?.closest(".mac-finder")
            ? "finder"
            : (element?.className ?? "nothing");
      }, point);
    await dock.getByRole("button", { name: "Finder" }).click();
    await page.waitForTimeout(400);
    const spot = await overlap();
    step("Finder and the movie overlap", Boolean(spot), JSON.stringify(spot));
    step(
      "without Float on Top, Finder in front covers the movie",
      (await onTopAt(spot)) === "finder",
    );
    await dock.getByRole("button", { name: "QuickTime Player" }).click();
    await page.waitForTimeout(300);
    const floatRow = page
      .getByRole("menuitemcheckbox", { name: "Float on Top", exact: true })
      .first();
    await openMenu("View");
    await floatRow.click();
    await page.waitForTimeout(200);
    await dock.getByRole("button", { name: "Finder" }).click();
    await page.waitForTimeout(400);
    step(
      "with Float on Top, the movie stays over Finder in front",
      (await onTopAt(spot)) === "quicktime",
    );
    // On Finder's title bar beside the floating movie, whose own title takes a click over it.
    const finderBox = await page.locator(".mac-window.mac-finder").first().boundingBox();
    const movieBox = await frame.boundingBox();
    const besideMovie = movieBox.x + movieBox.width + 20;
    await page.mouse.click(
      besideMovie < finderBox.x + finderBox.width - 10 ? besideMovie : movieBox.x - 20,
      finderBox.y + 12,
    );
    await page.waitForTimeout(300);
    step("also after a click on Finder", (await onTopAt(spot)) === "quicktime");
    await page.mouse.move(5, 500);
    await page.waitForTimeout(300);
    const menuBarBox = await bar.boundingBox();
    // Finder is the active app after that click: the row is in QuickTime Player's own View menu.
    await dock.getByRole("button", { name: "QuickTime Player" }).click();
    await page.waitForTimeout(300);
    await openMenu("View");
    await page.waitForTimeout(200);
    await shot(page, path.join(out, "quicktime-float-on-top.png"));
    const menuAtTop = await floatRow
      .evaluate((each) => each.getAttribute("aria-checked"))
      .catch(() => null);
    step(
      "a menu of the menu bar still opens over it, and shows the row checked",
      menuAtTop === "true" && (await page.getByRole("menu").first().isVisible()),
      `${menuAtTop} ${JSON.stringify(menuBarBox)}`,
    );
    await closeMenu();
    step(
      "the Dock stays above it",
      await page.evaluate(() => {
        const frame = document.querySelector(
          '.mac-managed-window[data-window-id="quicktime-player"]',
        );
        const dock = document.querySelector('[aria-label="Dock"]');
        return Number(getComputedStyle(frame).zIndex) < Number(getComputedStyle(dock).zIndex);
      }),
    );

    // The contextual menu: a secondary click on the picture.
    const box = await frame.boundingBox();
    const picturePoint = { x: box.x + box.width / 2, y: box.y + box.height * 0.3 };
    await page.mouse.click(picturePoint.x, picturePoint.y, { button: "right" });
    const contextMenu = page.getByRole("menu", { name: "Movie" });
    await contextMenu.waitFor({ timeout: 5_000 });
    await page.waitForTimeout(200);
    await shot(page, path.join(out, "quicktime-context-menu.png"));
    const contextRow = (name) => contextMenu.getByRole("menuitem", { name, exact: true });
    step(
      "the menu at the picture has its rows",
      (await contextRow("Play").count()) === 1 &&
        (await contextRow("Actual Size").count()) === 1 &&
        (await contextRow("Show Movie Inspector").count()) === 1,
    );
    await contextRow("Play").click();
    step(
      "Play from that menu plays the movie",
      await until(() => video.evaluate((each) => !each.paused && each.currentTime > 0.1), 5_000),
    );
    await page.mouse.click(picturePoint.x, picturePoint.y, { button: "right" });
    await contextMenu.waitFor({ timeout: 5_000 });
    await contextRow("Pause").click();
    step(
      "Pause from that menu pauses it",
      await until(() => video.evaluate((each) => each.paused), 5_000),
    );
    await page.mouse.click(picturePoint.x, picturePoint.y, { button: "right" });
    await contextMenu.waitFor({ timeout: 5_000 });
    const before2 = await frame.boundingBox();
    await contextRow("Increase Size").click();
    step(
      "Increase Size from that menu makes the window larger",
      await until(async () => (await frame.boundingBox()).width > before2.width + 20, 5_000),
      JSON.stringify(await frame.boundingBox()),
    );
    const small = await frame.boundingBox();
    await page.mouse.click(small.x + small.width / 2, small.y + small.height * 0.3, {
      button: "right",
    });
    await contextMenu.waitFor({ timeout: 5_000 });
    await contextMenu.getByRole("menuitemcheckbox", { name: "Float on Top" }).click();
    await page.waitForTimeout(200);
    step(
      "Float on Top is the same check there: choosing it lets the window go back",
      (await player.getAttribute("data-float-on-top")) === null,
    );
    await page.mouse.click(small.x + small.width / 2, small.y + small.height * 0.3, {
      button: "right",
    });
    await contextMenu.waitFor({ timeout: 5_000 });
    await contextRow("Show Movie Inspector").click();
    step(
      "Show Movie Inspector from that menu opens the inspector",
      await until(() => page.getByRole("region", { name: "Movie Inspector" }).isVisible(), 5_000),
    );
  } finally {
    for (const id of made.filter(Boolean)) {
      await api(page, "POST", "/api/files/ops", { ops: [{ op: "delete", id }] }).catch(() => {});
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

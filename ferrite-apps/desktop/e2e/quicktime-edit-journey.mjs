#!/usr/bin/env node
// QuickTime Player's edits on the desktop served by `ferrite dev`: Edit > Trim with its handles, Undo and
// Redo, Rotate Right, Flip Horizontal, Remove Audio, Save with the question on closing, Export As 480p and
// Audio Only, Duplicate and Open Location. Each result is measured from the movie the window then plays, or
// read back from the drive. Exits 0 only with every step passed and no console or HTTP error.
//
//   node e2e/quicktime-edit-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { base, out } = options();
const { step, run } = journey("quicktime-edit");

async function until(check, ms = 60_000) {
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
  const LIBRARY = "/api/app-store/library";
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes("quicktime-player")) {
    await api(page, "PUT", LIBRARY, {
      installed: [...(held.installed ?? []), "quicktime-player"],
      rev: held.rev,
    });
  }
  await reloadDesktop(page);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("QuickTime Player");
  await field.press("Enter");
  const qt = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  await qt.waitFor({ state: "visible", timeout: 15_000 });
  const chooser = page.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await chooser).setFiles(path.join(here, "fixtures", "test-pattern.webm"));

  const video = qt.locator("video.mac-quicktime-player-video");
  const measure = () =>
    video.evaluate((each) => ({
      length: each.duration,
      width: each.videoWidth,
      height: each.videoHeight,
    }));
  const measured = (test) =>
    until(async () => {
      const now = await measure();
      return Number.isFinite(now.length) && now.length > 0 && test(now) ? now : false;
    });
  const original = await measured(() => true);
  step("the movie opens with a length", original?.length > 5, JSON.stringify(original));

  const bar = page.getByRole("menubar").first();
  const choose = async (menu, item) => {
    await bar.getByRole("menuitem", { name: menu, exact: true }).click();
    await page.getByRole("menuitem", { name: item, exact: true }).first().click();
  };
  const idle = () =>
    qt.locator(".mac-quicktime-player-work").getByRole("progressbar").waitFor({
      state: "detached",
      timeout: 60_000,
    });

  await choose("Edit", "Trim…");
  const handle = qt.getByRole("slider", { name: "Trim end" });
  await handle.waitFor({ timeout: 5_000 });
  await handle.focus();
  const back = Math.ceil(original.length) - 3;
  for (let at = 0; at < back; at += 1) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "quicktime-trim.png"));
  await qt.getByRole("button", { name: "Trim", exact: true }).click();
  const trimmed = await measured((now) => now.length < original.length - 3);
  step(
    "Trim leaves a shorter movie",
    trimmed?.length < original.length - 3,
    JSON.stringify(trimmed),
  );
  await idle();
  await until(async () => (await qt.innerText()).includes("Edited"), 5_000);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "quicktime-trimmed.png"));
  step("the window says it is edited", (await qt.getByText(/Edited/).count()) > 0);

  await choose("Edit", "Undo");
  const undone = await measured((now) => now.length > original.length - 1);
  step("Undo brings the whole movie back", Boolean(undone), JSON.stringify(undone));
  await choose("Edit", "Redo");
  const redone = await measured((now) => now.length < original.length - 3);
  step("Redo trims it again", Boolean(redone), JSON.stringify(redone));

  await choose("Edit", "Rotate Right");
  const turned = await measured(
    (now) => now.width === original.height && now.height === original.width,
  );
  step("Rotate Right swaps the picture's sides", Boolean(turned), JSON.stringify(turned));
  await idle();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "quicktime-rotated.png"));

  // The fixture's colour bars stand upright: its left and right edges differ, its top and bottom do not.
  const colours = (points) =>
    video.evaluate(async (each, wanted) => {
      each.pause();
      each.currentTime = 0.5;
      await new Promise((done) => each.addEventListener("seeked", done, { once: true }));
      const canvas = document.createElement("canvas");
      canvas.width = each.videoWidth;
      canvas.height = each.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(each, 0, 0);
      return wanted.map(([x, y]) => [
        ...context.getImageData(
          Math.floor(x * (each.videoWidth - 1)),
          Math.floor(y * (each.videoHeight - 1)),
          1,
          1,
        ).data,
      ]);
    }, points);
  const near = (a, b) => a.slice(0, 3).every((value, index) => Math.abs(value - b[index]) < 40);
  const SIDES = [
    [0.02, 0.5],
    [0.98, 0.5],
  ];
  const ENDS = [
    [0.5, 0.02],
    [0.5, 0.98],
  ];
  const turnedEnds = await colours(ENDS);

  await choose("Edit", "Undo");
  await measured((now) => now.width === original.width);
  await page.waitForTimeout(500);
  const before = await colours(SIDES);
  step(
    "Rotate Right turned it clockwise: the left edge went to the top",
    !near(before[0], before[1]) && near(before[0], turnedEnds[0]) && near(before[1], turnedEnds[1]),
    JSON.stringify({ before, turnedEnds }),
  );

  await choose("Edit", "Flip Horizontal");
  await idle();
  await page.waitForTimeout(1_000);
  const after = await colours(SIDES);
  step(
    "Flip Horizontal changes sides",
    near(before[0], after[1]) && near(before[1], after[0]),
    JSON.stringify({ before, after }),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "quicktime-flipped.png"));

  await choose("Edit", "Rotate Left");
  await measured((now) => now.width === original.height);
  await idle();
  await page.waitForTimeout(500);
  const leftEnds = await colours(ENDS);
  await choose("Edit", "Flip Vertical");
  await idle();
  await page.waitForTimeout(1_000);
  const flippedEnds = await colours(ENDS);
  step(
    "Flip Vertical changes top and bottom",
    !near(leftEnds[0], leftEnds[1]) &&
      near(leftEnds[0], flippedEnds[1]) &&
      near(leftEnds[1], flippedEnds[0]),
    JSON.stringify({ leftEnds, flippedEnds }),
  );
  await choose("Edit", "Undo");
  await page.waitForTimeout(300);
  await choose("Edit", "Undo");
  await measured((now) => now.width === original.width);
  await page.waitForTimeout(500);

  // A close with changes asks first.
  await qt.getByRole("button", { name: "Close", exact: true }).first().click();
  const asked = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  await asked.getByText(/save the changes/).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "quicktime-close-ask.png"));
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  step("closing an edited movie asks first, and Cancel keeps it", await qt.isVisible());

  // What each command leaves is found by what was not in Movies before it, and opened again from there.
  const movieIds = async () =>
    new Set(((await api(page, "GET", "/api/files/")).json.entries ?? []).map((each) => each.id));
  const madeSince = async (before, words) => {
    const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
    return entries.find(
      (each) => !before.has(each.id) && each.parent === "movies" && each.name.includes(words),
    );
  };
  const reopen = async (name, test) => {
    await choose("File", "Open File…");
    const row = qt.getByRole("option", { name, exact: true });
    await row.waitFor({ timeout: 15_000 });
    await row.dblclick();
    await qt
      .getByRole("option", { name, exact: true })
      .waitFor({ state: "detached", timeout: 15_000 });
    return measured(test);
  };
  // Whether the file the window plays holds sound above silence, decoded from its own bytes.
  const audible = () =>
    video.evaluate(async (each) => {
      const bytes = await (await fetch(each.src)).arrayBuffer();
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(bytes);
      await context.close();
      return decoded.getChannelData(0).some((sample) => Math.abs(sample) > 0.01);
    });

  const beforeSave = await movieIds();
  const editedLength = (await measure()).length;
  // Save would write over the fixture, which the rows below play again whole: Save As… keeps it.
  await choose("File", "Save As…");
  const saveAsName = page.getByRole("textbox", { name: "Name of the new movie" });
  await saveAsName.waitFor({ timeout: 5_000 });
  await saveAsName.fill(`test-pattern edited ${Date.now().toString(36)}`);
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  const saved = await until(() => madeSince(beforeSave, "edited"), 30_000);
  await until(async () => (await qt.getByText(/Edited/).count()) === 0, 10_000);
  await idle();
  const savedBack = saved ? await reopen(saved.name, (now) => now.width > 0) : false;
  step(
    "Save As… makes a new file in Movies, and it opens with the edited movie and its sound",
    Boolean(savedBack) &&
      Math.abs(savedBack.length - editedLength) < 0.5 &&
      savedBack.length < original.length - 3 &&
      (await audible()) === true,
    JSON.stringify(savedBack),
  );

  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export As", exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "quicktime-export-as.png"));
  const beforeExport = await movieIds();
  await page.getByRole("menuitem", { name: "Audio Only", exact: true }).click();
  const exported = await until(() => madeSince(beforeExport, "audio only"), 60_000);
  await idle();
  const exportedBack = exported ? await reopen(exported.name, (now) => now.width === 0) : false;
  step(
    "Export As > Audio Only makes a new file in Movies holding the sound alone",
    Boolean(exportedBack) &&
      Math.abs(exportedBack.length - savedBack.length) < 0.5 &&
      (await audible()) === true,
    JSON.stringify(exportedBack),
  );

  await reopen(saved.name, (now) => now.width > 0);
  const beforeCopy = await movieIds();
  await choose("File", "Duplicate");
  const copied = await until(() => madeSince(beforeCopy, " copy"), 30_000);
  await idle();
  const copiedBack = copied ? await reopen(copied.name, (now) => now.width > 0) : false;
  step(
    "Duplicate makes a new file in Movies with the same movie",
    Boolean(copiedBack) &&
      copiedBack.width === savedBack.width &&
      Math.abs(copiedBack.length - savedBack.length) < 0.5,
    JSON.stringify(copiedBack),
  );

  const decoded = async () => {
    await video.evaluate(async (each) => {
      each.currentTime = 0;
      each.muted = true;
      await each.play();
      await new Promise((done) => setTimeout(done, 800));
      each.pause();
    });
    return video.evaluate((each) => each.webkitAudioDecodedByteCount);
  };
  const soundBefore = await decoded();
  await choose("Edit", "Remove Audio");
  await idle();
  await page.waitForTimeout(800);
  const soundAfter = await decoded();
  step(
    "Remove Audio leaves a playable movie with no sound decoded",
    Boolean(await measured((now) => now.width > 0)) && soundBefore > 0 && soundAfter === 0,
    `${soundBefore} bytes of sound before, ${soundAfter} after`,
  );
  await choose("Edit", "Undo");
  await page.waitForTimeout(500);

  // Open Location plays what the address gives, here the drive's own read of the file.
  const entries = (await api(page, "GET", "/api/files/")).json.entries ?? [];
  const file = entries.find((each) => each.name === "test-pattern.webm");
  await choose("File", "Open Location…");
  const address = page.getByRole("textbox", { name: "Address of the movie" });
  await address.fill(`/api/files/content/${file?.id}`);
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "quicktime-location.png"));
  await page.getByRole("button", { name: "Open", exact: true }).last().click();
  const played = await measured((now) => Math.abs(now.length - original.length) < 1);
  step("Open Location plays a movie from its address", Boolean(played), JSON.stringify(played));

  // From an idle recording window as well.
  await choose("File", "New Movie Recording");
  await qt
    .getByRole("button", { name: /record/i })
    .first()
    .waitFor({ timeout: 15_000 });
  await choose("File", "Open Location…");
  await address.fill(`/api/files/content/${file?.id}`);
  await page.getByRole("button", { name: "Open", exact: true }).last().click();
  const playedThen = await measured((now) => Math.abs(now.length - original.length) < 1);
  step("Open Location works from a recording window", Boolean(playedThen));

  // A portrait movie made in the page: Export As goes by the movie's height, and the export is that tall.
  const portrait = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 1280;
    const draw = canvas.getContext("2d");
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const pieces = [];
    recorder.ondataavailable = (event) => pieces.push(event.data);
    const ended = new Promise((done) => {
      recorder.onstop = done;
    });
    recorder.start();
    const painting = setInterval(() => {
      draw.fillStyle = `hsl(${Date.now() % 360} 80% 50%)`;
      draw.fillRect(0, 0, 720, 1280);
    }, 60);
    await new Promise((done) => setTimeout(done, 1_500));
    recorder.stop();
    await ended;
    clearInterval(painting);
    const bytes = new Uint8Array(await new Blob(pieces).arrayBuffer());
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  });
  await choose("File", "Open File…");
  const picking = page.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await picking).setFiles({
    name: "portrait.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(portrait, "base64"),
  });
  await measured((now) => now.height === 1280);
  await idle();
  await bar.getByRole("menuitem", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export As", exact: true }).click();
  const row = (name) => page.getByRole("menuitem", { name, exact: true });
  await row("1080p").waitFor({ timeout: 5_000 });
  step(
    "Export As offers what the movie's height allows: 1080p of 1280, and not 4K",
    (await row("1080p").getAttribute("aria-disabled")) !== "true" &&
      (await row("4K").getAttribute("aria-disabled")) === "true",
  );
  const beforeSized = await movieIds();
  await row("1080p").click();
  const sized = await until(() => madeSince(beforeSized, "1080p"), 60_000);
  await idle();
  const sizedBack = sized ? await reopen(sized.name, (now) => now.height > 0) : false;
  step(
    "Export As > 1080p makes a new file in Movies 1080 high, in the movie's proportion",
    sizedBack?.height === 1080 && sizedBack?.width === 608,
    JSON.stringify(sizedBack),
  );
});

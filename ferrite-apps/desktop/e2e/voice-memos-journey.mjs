#!/usr/bin/env node
// Voice Memos on Ferrite: get Voice Memos from the session's library, open it
// from Spotlight with the browser's microphone (Playwright's fake microphone in
// each engine), record about three seconds and find the recording as an audio
// file in Music/Voice Memos on the person's drive, listed with its length. Reload
// the page, open Voice Memos again and find it still listed; play it and watch
// the audio advance; rename it and find the drive's file renamed; trim it and
// find a shorter WAV file in its place with the original in the Trash; delete
// it and find it in the drive's Trash. Before playing, a second browser of the same engine, signed
// in as a guest of its own and with its microphone permission denied by the browser itself
// (Chromium without its fake prompt, Firefox with the microphone blocked, WebKit with no
// permission granted), finds no recording in its Voice Memos or its drive, and New Recording
// tells it, in Voice Memos' words, that the microphone is not allowed, starts no take and saves
// nothing. Exits 0 only when every step passed and
// the page logged no console error, page error, failed request or HTTP error. It
// removes what it made at the end, and only that: its files, the Voice Memos
// folder if it made it, and Voice Memos' place in the session's library.
//
// Firefox plays sound only with an audio output device; on a headless Linux host
// start one first (PulseAudio's null sink: `pulseaudio --start --exit-idle-time=-1`).
//
//   ferrite dev                                        # in ferrite-apps/desktop
//   node e2e/voice-memos-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                    [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { ENGINES, engineFamily } from "./journey-kit.mjs";

const LIBRARY = "/api/app-store/library";
const FOLDER = "Voice Memos";
const NEW_TITLE = "Journey Memo";
const { base, out, browserName } = options();
// A microphone for the page without a prompt: Chromium's and Firefox's fake devices, and
// WebKit's mock microphone with the microphone permission granted to the context.
const { step, run } = journey("voice-memos", {
  launchOptions: {
    chromium: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
    firefox: {
      firefoxUserPrefs: {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": true,
      },
    },
  },
  contextOptions: { webkit: { permissions: ["microphone"] } },
});

async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

/** The Voice Memos window, once its recordings are listed. Its name is the recording shown. */
async function open(page) {
  await openWithSpotlight(page, "Voice Memos");
  const window = page.locator('[data-window-id="voice-memos"] .mac-voice-memos').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    {
      timeout: 15_000,
    },
  );
  return window;
}

/** The drive's Music/Voice Memos folder, its live audio files and the whole drive. */
async function voiceMemos(page) {
  const drive = (await api(page, "GET", "/api/files/")).json;
  const entries = drive.entries ?? [];
  const folder = entries.find(
    (entry) =>
      entry.kind === "folder" &&
      entry.parent === "music" &&
      entry.trashed_ms === undefined &&
      entry.name === FOLDER,
  );
  const files = folder
    ? entries.filter(
        (entry) =>
          entry.parent === folder.id && entry.kind === "file" && entry.trashed_ms === undefined,
      )
    : [];
  return { folder, files, entries };
}

/** Polls the drive until `test` answers something, or 20 seconds pass. */
async function until(page, test) {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const found = test(await voiceMemos(page));
    if (found || Date.now() > deadline) return found;
    await page.waitForTimeout(250);
  }
}

/** The length the player shows for the chosen recording, in seconds: its slider's maximum. */
const shownLength = async (window) =>
  Number(await window.getByRole("slider", { name: "Recording position" }).getAttribute("max"));

/** The length of a drive file as the browser decodes it, in seconds. */
const decodedLength = (page, id) =>
  page.evaluate(async (file) => {
    const response = await fetch(`/api/files/content/${encodeURIComponent(file)}?piece=0&count=8`, {
      credentials: "same-origin",
    });
    const context = new OfflineAudioContext(1, 1, 44_100);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    return buffer.duration;
  }, id);

/** The heights of the detailed waveform's bars, in points. */
const barHeights = (window) =>
  window
    .locator(".mac-waveform-view-bars path")
    .first()
    .evaluate((path) =>
      [...(path.getAttribute("d") ?? "").matchAll(/v([\d.]+)/g)].map((match) => Number(match[1])),
    );

/**
 * A browser of the same engine whose microphone the browser itself refuses, as a person who
 * declines the permission prompt: Chromium has its fake device and answers every permission prompt
 * with a denial (`--deny-permission-prompts`). Headless Chromium cannot run the prompt at all and
 * reports "NotSupportedError: Not supported" however its permissions are set, so this Chromium runs
 * headed, on the display `DISPLAY` names, where the prompt is denied as a person would (a
 * `NotAllowedError`). Firefox blocks the microphone by default, and WebKit grants no microphone
 * permission.
 */
const DENYING = {
  chromium: {
    launch: {
      headless: false,
      args: ["--use-fake-device-for-media-stream", "--deny-permission-prompts"],
    },
    context: {},
    needsDisplay: true,
  },
  firefox: {
    launch: {
      firefoxUserPrefs: {
        "media.navigator.streams.fake": true,
        "media.navigator.permission.disabled": false,
        "permissions.default.microphone": 2,
      },
    },
    context: {},
  },
  webkit: { launch: {}, context: {} },
};

/**
 * Another person, in a browser of their own that denies the microphone: their Voice Memos and
 * drive hold none of this session's recordings, and New Recording tells them, in Voice Memos'
 * words, that the microphone is not allowed, without starting a take or saving anything.
 */
async function deniedElsewhere() {
  const engine = ENGINES[browserName];
  const { launch, context: contextOptions, needsDisplay } = DENYING[engineFamily(browserName)];
  if (needsDisplay && !process.env.DISPLAY) {
    console.log(
      "skip with the microphone denied by the browser, New Recording says so in Voice Memos' words (Chromium denies its permission prompt only when headed; set DISPLAY to a display)",
    );
    return;
  }
  const browser = await engine.launch(launch);
  const errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...contextOptions,
    });
    const other = await context.newPage();
    other.on("pageerror", (error) => errors.push(error.message));
    await openDesktop(other, base, () => true);
    const library = await api(other, "GET", LIBRARY);
    await api(other, "PUT", LIBRARY, {
      installed: [...(library.json.installed ?? []), "voice-memos"],
      rev: library.json.rev,
    });
    await reloadDesktop(other);
    const window = await open(other);
    const theirs = await voiceMemos(other);
    step(
      "another person's Voice Memos and drive have none of this session's recordings",
      theirs.files.length === 0 && (await window.getByRole("option").count()) === 0,
      `${theirs.files.length} files, ${await window.getByRole("option").count()} listed`,
    );
    const uploads = [];
    other.on("request", (request) => {
      if (new globalThis.URL(request.url()).pathname.startsWith("/api/files/uploads")) {
        uploads.push(request.url());
      }
    });
    await window.getByRole("button", { name: "New Recording" }).click();
    const alert = window
      .getByRole("alert")
      .filter({ hasText: /not allowed to use the microphone/ });
    const told = await alert.waitFor({ timeout: 15_000 }).then(
      () => true,
      () => false,
    );
    const message = told ? ((await alert.textContent()) ?? "") : "";
    await other.waitForTimeout(1_000);
    const after = await voiceMemos(other);
    step(
      "with the microphone denied by the browser, New Recording says so in Voice Memos' words",
      told && /Allow it in the browser's settings for this site/.test(message),
      message.slice(0, 160),
    );
    step(
      "and starts no take, uploads nothing and lists nothing, with no page error",
      (await window.getByRole("button", { name: "Pause Recording" }).count()) === 0 &&
        uploads.length === 0 &&
        after.files.length === 0 &&
        (await window.getByRole("option").count()) === 0 &&
        errors.length === 0,
      `${uploads.length} uploads, ${after.files.length} files, ${errors.length} page errors`,
    );
    await shot(other, path.join(out, `voice-memos-denied-${browserName}.png`));
    await uninstall(other).catch(() => {});
  } finally {
    await browser.close();
  }
}

/** The journey's steps; `made` records what it created, for the cleanup in `finally`. */
async function walk(page, made) {
  await openDesktop(page, base, step);
  // The journey's browser is a new one, with a session of its own; it touches nothing it did
  // not make, so it expects that session to have no recordings yet.
  const before = await voiceMemos(page);
  step(
    "the session has no recordings yet",
    before.files.length === 0,
    `${before.files.length} found`,
  );
  if (!before.folder) made.folderMayBeOurs = true;

  // Voice Memos does not come with the desktop: get it, as the App Store would.
  const library = await api(page, "GET", LIBRARY);
  const installed = library.json.installed ?? [];
  const got = await api(page, "PUT", LIBRARY, {
    installed: [...installed.filter((id) => id !== "voice-memos"), "voice-memos"],
    rev: library.json.rev,
  });
  if (got.status === 200 && !installed.includes("voice-memos")) made.installed = true;
  step("Voice Memos is in the session's library", got.status === 200, `status ${got.status}`);
  await reloadDesktop(page);

  let window = await open(page);
  step("Voice Memos opens with no recordings", (await window.getByRole("option").count()) === 0);

  // Record about three seconds.
  await window.getByRole("button", { name: "New Recording" }).click();
  await window.getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
  step("New Recording starts a take from the microphone", true);
  await page.waitForTimeout(3_000);
  const timer = await window.getByRole("timer", { name: "Position" }).textContent();
  step("the timer runs while recording", /^00:0[2-9]\./.test(timer ?? ""), timer);
  const live = await barHeights(window);
  step(
    "the waveform draws the microphone's levels while recording",
    live.some((height) => height > 2),
    `${live.length} bars, tallest ${Math.max(0, ...live).toFixed(1)} pt`,
  );

  const completed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /^\/api\/files\/uploads\/[^/]+\/complete$/.test(new globalThis.URL(response.url()).pathname),
    { timeout: 20_000 },
  );
  await window.getByRole("button", { name: "Done" }).click();
  const upload = await completed;
  step(
    "Done saves the recording to the drive",
    upload.status() === 200,
    `status ${upload.status()}`,
  );

  // A take is saved as "New Recording", then "New Recording 2" and so on, with the extension of
  // whatever the browser records (WebM, Ogg, MP4 or WAV).
  const saved = await until(page, ({ files }) =>
    files.find((file) => /^New Recording( \d+)?\.[a-z0-9]+$/.test(file.name)),
  );
  if (saved) made.files.add(saved.id);
  const after = await voiceMemos(page);
  if (made.folderMayBeOurs && after.folder) made.folder = after.folder.id;
  step(
    "the recording is an audio file in Music/Voice Memos on the drive",
    saved?.size > 0 && /^audio\//.test(saved?.type ?? "") && after.files.length === 1,
    saved && `${saved.name}, ${saved.size} bytes, ${saved.type}`,
  );

  const row = window.getByRole("option", { name: /^New Recording/ });
  await row.waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    (frame) => {
      const length = frame.querySelector(".mac-voice-memos-length")?.textContent ?? "";
      return /^\d\d:\d\d$/.test(length) && length !== "00:00";
    },
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  const recorded = await shownLength(window);
  step(
    "the list shows it with its length",
    /^New Recording( \d+)?Today/.test(await row.textContent()) && recorded > 1,
    `${await row.textContent()}, ${recorded.toFixed(2)} s`,
  );

  // Kept per person: after a reload it is still there.
  await reloadDesktop(page);
  window = await open(page);
  const kept = window.getByRole("option", { name: /^New Recording/ });
  await kept.waitFor({ timeout: 10_000 });
  step(
    "after a reload, the list still has the recording",
    (await window.getByRole("option").count()) === 1,
  );

  // Another person, whose browser denies the microphone, while this session holds a recording.
  await deniedElsewhere();

  // Play it.
  const play = window.getByRole("button", { name: "Play" });
  await page.waitForFunction(
    (frame) => {
      const button = frame.querySelector(".mac-voice-memos-play");
      return button && !button.disabled;
    },
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  await play.click();
  await page.waitForFunction(
    (frame) => (frame.querySelector("audio")?.currentTime ?? 0) > 0.3,
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  const playedTo = await window.locator("audio").evaluate((audio) => audio.currentTime);
  step("Play plays the recording: its audio advances", playedTo > 0.3, `${playedTo.toFixed(2)} s`);
  const pause = window.getByRole("button", { name: "Pause" });
  if (await pause.isVisible()) await pause.click();

  // Rename it from its row.
  await kept.dblclick();
  const field = window.getByRole("textbox", { name: "Recording name" });
  await field.fill(NEW_TITLE);
  await page.keyboard.press("Enter");
  const renamed = await until(page, ({ entries }) =>
    entries.find((entry) => entry.id === saved?.id && entry.name.startsWith(`${NEW_TITLE}.`)),
  );
  step(
    "Rename renames the drive's file, keeping its extension",
    renamed?.name === `${NEW_TITLE}${saved?.name.slice(saved.name.lastIndexOf("."))}`,
    renamed?.name,
  );
  await window
    .getByRole("option", { name: new RegExp(`^${NEW_TITLE}`) })
    .waitFor({ timeout: 10_000 });
  step("the list shows the new name", true);

  // Trim a second off its start.
  await window.getByRole("button", { name: "Edit" }).click();
  const trim = window.getByRole("button", { name: "Trim" });
  await page.waitForFunction(
    (frame) => {
      const button = frame.querySelector('[aria-label="Trim"]');
      return button && button.getAttribute("aria-disabled") !== "true" && !button.disabled;
    },
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  await trim.click();
  const start = window.getByRole("slider", { name: "Trim start" });
  await start.focus();
  await page.keyboard.press("PageUp");
  step(
    "the trim's start handle moves a second in",
    (await start.getAttribute("aria-valuetext")) === "00:01.00",
    await start.getAttribute("aria-valuetext"),
  );
  await window.getByRole("button", { name: "Save" }).click();
  const trimmed = await until(page, ({ files }) =>
    files.find((file) => file.id !== saved?.id && file.name === `${NEW_TITLE}.wav`),
  );
  if (trimmed) made.files.add(trimmed.id);
  const afterTrim = await voiceMemos(page);
  const original = afterTrim.entries.find((entry) => entry.id === saved?.id);
  step(
    "Trim saves a WAV file in its place and moves the original to the Trash",
    trimmed?.type === "audio/wav" &&
      afterTrim.files.length === 1 &&
      typeof original?.trashed_ms === "number",
    trimmed && `${trimmed.name}, ${trimmed.size} bytes`,
  );
  const trimmedLength = trimmed ? await decodedLength(page, trimmed.id) : 0;
  step(
    "the trimmed file is a second shorter",
    Math.abs(recorded - 1 - trimmedLength) < 0.15,
    `${recorded.toFixed(2)} s to ${trimmedLength.toFixed(2)} s`,
  );
  await page.waitForFunction(
    ({ frame, length }) =>
      Math.abs(
        Number(frame.querySelector('[aria-label="Recording position"]')?.getAttribute("max")) -
          length,
      ) < 0.05,
    { frame: await window.elementHandle(), length: trimmedLength },
    { timeout: 10_000 },
  );
  step("the window shows the trimmed length", true, `${(await shownLength(window)).toFixed(2)} s`);

  await window.getByRole("button", { name: "Done" }).click();
  await window
    .getByRole("option", { name: new RegExp(`^${NEW_TITLE}`) })
    .waitFor({ timeout: 10_000 });
  await shot(page, path.join(out, `voice-memos-${browserName}.png`));

  // Delete it: it goes to the drive's Trash, from where Finder can put it back.
  await window.getByRole("button", { name: "Delete", exact: true }).click();
  const deleted = await until(page, ({ entries }) =>
    entries.find((entry) => entry.id === trimmed?.id && typeof entry.trashed_ms === "number"),
  );
  step("Delete moves the recording to the drive's Trash", Boolean(deleted));
  await page.waitForFunction(
    (frame) => frame.querySelectorAll('[role="option"]').length === 0,
    await window.elementHandle(),
    { timeout: 10_000 },
  );
  step("the list is empty again", true);
}

/** Delete for good what the journey made: its files, then the folder if it made it. */
async function removeOwn(page, made) {
  const { entries } = await voiceMemos(page);
  const ops = [...made.files]
    .filter((id) => entries.some((entry) => entry.id === id))
    .map((id) => ({ op: "delete", id }));
  if (made.folder && entries.some((entry) => entry.id === made.folder)) {
    ops.push({ op: "delete", id: made.folder });
  }
  if (ops.length > 0) {
    const done = await api(page, "POST", "/api/files/ops", { ops });
    if (done.status !== 200) throw new Error(`the drive answered ${done.status}`);
  }
  made.files.clear();
  made.folder = null;
}

/** Take Voice Memos out of the session's library again. */
async function uninstall(page) {
  const left = await api(page, "GET", LIBRARY);
  await api(page, "PUT", LIBRARY, {
    installed: (left.json.installed ?? []).filter((id) => id !== "voice-memos"),
    rev: left.json.rev,
  });
}

await run(async (page) => {
  const made = { files: new Set(), folder: null, folderMayBeOurs: false, installed: false };
  try {
    await walk(page, made);
  } finally {
    // A step that failed or timed out still leaves nothing of the journey's behind: its files
    // and the app-library entry are each cleaned up on their own, so one failing leaves the other.
    await removeOwn(page, made).catch((error) =>
      console.log(`warn cleanup of the recordings did not finish: ${error}`),
    );
    if (made.installed) {
      await uninstall(page).catch((error) =>
        console.log(`warn uninstall did not finish: ${error}`),
      );
    }
  }
});

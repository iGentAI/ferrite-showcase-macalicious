#!/usr/bin/env node
// Music, QuickTime Player and Voice Memos, batch 3, in the running app. Music: Crossfade, Sound Enhancer
// and Sound Check, measured from the two media elements and from the sound leaving the Web Audio graph;
// the Playback settings read back from the server and across a reload; the Audio output menu; Remember
// playback position and the Sorting fields; the Media Session's handlers. QuickTime Player: the Open window as Columns and Gallery, Export As
// at 720p, 480p and 4K, recording quality. Voice Memos: a recording handed to Notes by Share and by a
// drag, read back from Notes' server data, and found by Spotlight. `--only` runs one part.
//
//   node e2e/music-quicktime-batch3-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--only music|quicktime|voice]

import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { base, out } = options();
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const wanted = (part) => only === null || only === part;

/**
 * A camera of noise, which no encoder can squeeze: what the recorder's bit rate then decides. The
 * browser's fake camera loops this file, in place of its own easy picture.
 */
const noiseCamera = path.join(out, "batch3-noise.y4m");
const [frameWidth, frameHeight] = [640, 480];
writeFileSync(
  noiseCamera,
  Buffer.concat([
    Buffer.from(`YUV4MPEG2 W${frameWidth} H${frameHeight} F15:1 Ip A1:1 C420\n`),
    ...Array.from({ length: 15 }, () =>
      Buffer.concat([Buffer.from("FRAME\n"), randomBytes((frameWidth * frameHeight * 3) / 2)]),
    ),
  ]),
);
const { step, run } = journey("music-quicktime-batch3", {
  ignoreOtherOrigins: true,
  launchOptions: {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        `--use-file-for-fake-video-capture=${noiseCamera}`,
      ],
    },
  },
  contextOptions: { chromium: { permissions: ["microphone", "camera"] } },
});
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** A mono WAV of a sine: `seconds` long at `hz`, peaking at `amplitude`, named in a RIFF INFO list. */
function wav(title, { seconds, hz, amplitude, rate = 44_100 }) {
  const pcm = Buffer.alloc(rate * seconds * 2);
  for (let i = 0; i < pcm.length / 2; i += 1)
    pcm.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * hz) / rate) * amplitude * 32767),
      i * 2,
    );
  const chunk = (id, body) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const info = Buffer.concat([
    Buffer.from("INFO"),
    chunk("INAM", Buffer.from(`${title}\0`)),
    chunk("IART", Buffer.from("Batch\0")),
    chunk("IPRD", Buffer.from("Three\0")),
  ]);
  return chunk(
    "RIFF",
    Buffer.concat([
      Buffer.from("WAVE"),
      chunk("fmt ", fmt),
      chunk("LIST", info),
      chunk("data", pcm),
    ]),
  );
}

/** Lists every media element Music makes and the analyser at the end of its graph, read only. */
const WATCH_SOUND = () => {
  const RealAudio = window.Audio;
  window.__audios = [];
  window.Audio = function Audio(...args) {
    const made = new RealAudio(...args);
    window.__audios.push(made);
    return made;
  };
  window.Audio.prototype = RealAudio.prototype;
  const createAnalyser = AudioContext.prototype.createAnalyser;
  AudioContext.prototype.createAnalyser = function watched() {
    const made = createAnalyser.call(this);
    window.__analyser = made;
    window.__context = this;
    return made;
  };
  window.__mediaActions = {};
  const setActionHandler = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
  navigator.mediaSession.setActionHandler = (name, handler) => {
    window.__mediaActions[name] = handler;
    setActionHandler(name, handler);
  };
};

const elements = (page) =>
  page.evaluate(() =>
    window.__audios.map((each) => ({
      src: each.src.slice(0, 40),
      playing: !each.paused && !each.ended,
      volume: each.volume,
      at: each.currentTime,
      sink: each.sinkId,
    })),
  );

/** The power of the sound leaving the graph, as the RMS of what the analyser holds, over a second. */
const loudness = (page) =>
  page.evaluate(async () => {
    const analyser = window.__analyser;
    const samples = new Float32Array(analyser.fftSize);
    let total = 0;
    const rounds = 10;
    for (let n = 0; n < rounds; n += 1) {
      await new Promise((done) => setTimeout(done, 100));
      analyser.getFloatTimeDomainData(samples);
      total += samples.reduce((sum, each) => sum + each * each, 0) / samples.length;
    }
    return Math.sqrt(total / rounds);
  });

async function musicPart(page) {
  await launch(page, "Music");
  const music = page.getByRole("region", { name: "Music", exact: true }).first();
  await music.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await music.elementHandle(),
    { timeout: 15_000 },
  );
  const input = page.locator('input[type="file"][aria-label="Add to Library"]');
  await input.waitFor({ state: "attached", timeout: 15_000 });
  const songs = {
    "Aloud Tone": { seconds: 9, hz: 440, amplitude: 0.6 },
    "Soft Tone": { seconds: 9, hz: 440, amplitude: 0.06 },
    "Zinc Tone": { seconds: 6, hz: 10_000, amplitude: 0.1 },
  };
  const files = Object.entries(songs).map(([title, shape]) => {
    const file = path.join(out, `batch3-${title.split(" ")[0]}.wav`);
    writeFileSync(file, wav(title, shape));
    return file;
  });
  await input.setInputFiles(files);
  const library = async () => (await api(page, "GET", "/api/music/library")).json?.library;
  step(
    "three songs of known level are imported",
    await until(async () => (await library())?.songs?.length === 3, 20_000),
  );
  const kept = async () => (await api(page, "GET", "/api/music/preferences")).json?.preferences;
  const openPlayback = async () => {
    await page.keyboard.press("Control+,");
    await page.getByRole("tab", { name: "Playback" }).click();
  };
  const box = (name) => page.getByRole("checkbox", { name });
  const ok = () => page.getByRole("button", { name: "OK" }).first().click();

  // ---- Preferences: the Playback pane acts, and is kept -----------------------------------------
  await music.getByRole("treeitem", { name: "Songs", exact: true }).first().click();
  await openPlayback();
  step(
    "the Playback pane is not dimmed",
    (await box("Crossfade songs").getAttribute("aria-disabled")) !== "true" &&
      (await box("Sound Enhancer").getAttribute("aria-disabled")) !== "true" &&
      (await box("Sound Check").getAttribute("aria-disabled")) !== "true",
  );
  await box("Crossfade songs").click();
  const length = page.getByRole("slider", { name: "Crossfade length" });
  await length.focus();
  for (let n = 0; n < 2; n += 1) await page.keyboard.press("ArrowLeft");
  await box("Sound Check").click();
  await shot(page, path.join(out, "batch3-music-playback-pane.png"));
  await ok();
  step(
    "Crossfade of 4 seconds and Sound Check are kept on the server",
    await until(async () => {
      const now = await kept();
      return now?.crossfade === true && now?.crossfadeSeconds === 4 && now?.soundCheck === true;
    }, 6_000),
    JSON.stringify(await kept()),
  );
  await reloadDesktop(page);
  await launch(page, "Music");
  await music.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await music.elementHandle(),
    { timeout: 15_000 },
  );
  await music.getByRole("treeitem", { name: "Songs", exact: true }).first().click();
  await openPlayback();
  step(
    "after a reload the pane shows them",
    (await box("Crossfade songs").getAttribute("aria-checked")) === "true" &&
      (await box("Sound Check").getAttribute("aria-checked")) === "true" &&
      (await page.getByText("4 seconds").isVisible()),
  );
  await page.getByRole("button", { name: "Cancel" }).first().click();

  // ---- Crossfade: two elements sound at once, one fading out and the other in --------------------
  await music
    .getByRole("row", { name: /Aloud Tone/ })
    .first()
    .dblclick();
  const samples = [];
  const firstSound = await until(async () => (await elements(page)).some((each) => each.playing));
  step("the song plays", firstSound);
  const end = Date.now() + 9_000;
  let aloudLevel = null;
  while (Date.now() < end) {
    const now = await elements(page);
    samples.push(now);
    if (aloudLevel === null && now.find((each) => each.playing)?.at > 2) {
      aloudLevel = await loudness(page);
    }
    await sleep(150);
  }
  const both = samples.filter((now) => now.filter((each) => each.playing).length === 2);
  const midway = both.find((now) => now.every((each) => each.volume > 0.15 && each.volume < 0.95));
  step(
    "Crossfade: two songs sound together, each fading",
    both.length >= 5 && Boolean(midway),
    `${both.length} samples of two playing; ${JSON.stringify(midway)}`,
  );
  const after = await elements(page);
  step(
    "after the crossfade one song plays, at full level",
    after.filter((each) => each.playing).length === 1 &&
      after.find((each) => each.playing)?.volume > 0.95,
    JSON.stringify(after),
  );
  const playback = (await api(page, "GET", "/api/music/playback")).json?.playback;
  const soundsNow = (await library()).songs.find(
    (song) => song.id === playback.queue[playback.index],
  );
  step(
    "the next song is the one shown, and the first counts as played",
    soundsNow?.title === "Soft Tone" && Object.keys(playback.plays ?? {}).length === 1,
    JSON.stringify({ now: soundsNow?.title, plays: playback.plays }),
  );

  // ---- Sound Check: a tenth of the amplitude comes out at the same level -------------------------
  const softLevel = await loudness(page);
  step(
    "Sound Check: the song at a tenth of the level sounds as loud as the first",
    aloudLevel > 0.05 && softLevel > 0.05 && Math.abs(softLevel / aloudLevel - 1) < 0.25,
    `loud ${aloudLevel?.toFixed(3)}, soft ${softLevel?.toFixed(3)}`,
  );
  await openPlayback();
  await box("Sound Check").click();
  await ok();
  await until(async () => (await kept())?.soundCheck === false, 6_000);
  await sleep(500);
  const unchecked = await loudness(page);
  step(
    "turned off, the same song is back at its own level",
    unchecked < softLevel / 2.5,
    `with ${softLevel?.toFixed(3)}, without ${unchecked?.toFixed(3)}`,
  );

  // ---- Sound Enhancer: highs come out louder ---------------------------------------------------
  await page.keyboard.press("Space");
  await openPlayback();
  await box("Crossfade songs").click();
  await ok();
  await until(async () => (await kept())?.crossfade === false, 6_000);
  const play = async (title) => {
    await music
      .getByRole("row", { name: new RegExp(title) })
      .first()
      .dblclick();
    await until(async () => (await elements(page)).some((each) => each.playing && each.at > 0.4));
  };
  await play("Zinc Tone");
  const plain = await loudness(page);
  await openPlayback();
  await box("Sound Enhancer").click();
  const amount = page.getByRole("slider", { name: "Sound Enhancer amount" });
  await amount.focus();
  await page.keyboard.press("End");
  await ok();
  await until(async () => (await kept())?.soundEnhancerLevel === 100, 6_000);
  await play("Zinc Tone");
  await sleep(300);
  const enhanced = await loudness(page);
  step(
    "Sound Enhancer at High makes a 10 kHz tone louder, by what its shelf and trim say",
    enhanced / plain > 1.2 && enhanced / plain < 1.7,
    `off ${plain.toFixed(3)}, on ${enhanced.toFixed(3)}`,
  );
  await shot(page, path.join(out, "batch3-music-enhanced.png"));

  // ---- The Audio output menu -------------------------------------------------------------------
  const output = music.getByRole("button", { name: "Audio output" });
  await output.click();
  const rows = page.getByRole("menuitemradio");
  await rows.first().waitFor({ timeout: 5_000 });
  const names = await rows.allTextContents();
  await shot(page, path.join(out, "batch3-music-output.png"));
  step(
    "Audio output lists the browser's output and those it names",
    names[0] === "Browser’s Sound Output",
    names.join(", "),
  );
  const other = names.slice(1)[0];
  if (other) {
    await rows.nth(1).click();
    const sent = await until(async () => {
      const heardAt = await page.evaluate(() => window.__context?.sinkId);
      return typeof heardAt === "string" && heardAt !== "";
    });
    step(`choosing ${other} sends the sound there`, sent);
    await sleep(1_500);
    const settings = (await api(page, "GET", "/api/system-preferences/settings")).json;
    step(
      "and the choice is kept on the server",
      typeof JSON.stringify(settings).match(/"music\.output":"[^"]+"/)?.[0] === "string",
    );
    await reloadDesktop(page);
    await launch(page, "Music");
    await music.waitFor({ state: "visible", timeout: 15_000 });
    await music.getByRole("button", { name: "Audio output" }).click();
    await rows.first().waitFor({ timeout: 5_000 });
    await rows.nth(1).waitFor({ timeout: 5_000 });
    await until(async () => (await rows.nth(1).getAttribute("aria-checked")) === "true", 5_000);
    step(
      "and it is still chosen after a reload",
      (await rows.nth(1).getAttribute("aria-checked")) === "true",
      await rows.nth(1).evaluate((each) => each.outerHTML.slice(0, 200)),
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      (frame) => !frame.hasAttribute("aria-busy"),
      await music.elementHandle(),
      { timeout: 15_000 },
    );
    await music.getByRole("treeitem", { name: "Songs", exact: true }).first().click();
    await play("Zinc Tone");
    step(
      "and the sound goes there again",
      await until(async () => {
        const heardAt = await page.evaluate(() => window.__context?.sinkId);
        return typeof heardAt === "string" && heardAt !== "";
      }, 6_000),
    );
    await music.getByRole("button", { name: "Audio output" }).click();
    await rows.first().click();
  } else {
    await page.keyboard.press("Escape");
  }

  // ---- Song Info: Remember playback position and the two sort fields -----------------------------
  await music
    .getByRole("row", { name: /Soft Tone/ })
    .first()
    .click();
  await page.keyboard.press("Control+i");
  const info = page.getByRole("dialog").filter({ hasText: "Options" }).first();
  await info.getByText("Sorting", { exact: true }).first().click();
  await info.getByLabel("Sort Composer").fill("Row, Ada");
  await info.getByLabel("Sort Album Artist").fill("Batch, The");
  await info.getByText("Options", { exact: true }).first().click();
  await info.getByRole("checkbox", { name: "Remember playback position" }).click();
  await info.getByRole("button", { name: "OK" }).click();
  const softSong = async () => (await library())?.songs?.find((song) => song.title === "Soft Tone");
  step(
    "Song Info keeps Remember playback position, Sort Composer and Sort Album Artist on the server",
    await until(async () => {
      const song = await softSong();
      return (
        song?.rememberPosition === true &&
        song?.sortComposer === "Row, Ada" &&
        song?.sortAlbumArtist === "Batch, The"
      );
    }, 6_000),
    JSON.stringify(await softSong()),
  );
  await play("Soft Tone");
  await until(async () => (await elements(page)).some((each) => each.playing && each.at > 3));
  await play("Aloud Tone");
  const soft = await softSong();
  const place = async () =>
    (await api(page, "GET", "/api/music/playback")).json?.playback?.bookmarks?.[soft.id];
  await until(async () => (await place()) > 3, 6_000);
  const left = await place();
  await reloadDesktop(page);
  await launch(page, "Music");
  await music.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await music.elementHandle(),
    { timeout: 15_000 },
  );
  await music.getByRole("treeitem", { name: "Songs", exact: true }).first().click();
  await music
    .getByRole("row", { name: /Soft Tone/ })
    .first()
    .dblclick();
  const resumed = await until(
    async () => (await elements(page)).some((each) => each.playing && each.at >= left),
    6_000,
  );
  const startedAt = (await elements(page)).find((each) => each.playing)?.at;
  step(
    "after a reload, the song starts from where it was left",
    resumed && startedAt < left + 3,
    `left at ${left}, playing at ${startedAt}`,
  );

  // ---- The Media Session -----------------------------------------------------------------------
  await play("Soft Tone");
  const session = await page.evaluate(() => navigator.mediaSession.metadata?.title);
  step("the Media Session names the song", session === "Soft Tone", session);
  await page.evaluate(() => window.__mediaActions.pause?.({ action: "pause" }));
  const stopped = await until(
    async () => !(await elements(page)).some((each) => each.playing),
    5_000,
  );
  await page.evaluate(() => window.__mediaActions.play?.({ action: "play" }));
  const again = await until(async () => (await elements(page)).some((each) => each.playing), 5_000);
  await page.evaluate(() => window.__mediaActions.pause?.({ action: "pause" }));
  step("its pause and play handlers drive the player", stopped && again);
}

async function install(page, id) {
  const LIBRARY = "/api/app-store/library";
  const held = (await api(page, "GET", LIBRARY)).json;
  if (!(held.installed ?? []).includes(id)) {
    await api(page, "PUT", LIBRARY, { installed: [...(held.installed ?? []), id], rev: held.rev });
    await reloadDesktop(page);
  }
}

async function spotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await page.getByRole("option", { name, exact: true }).first().waitFor({ timeout: 10_000 });
  await field.press("Enter");
}

async function quicktimePart(page) {
  await install(page, "quicktime-player");
  await spotlight(page, "QuickTime Player");
  const qt = page.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  await qt.waitFor({ state: "visible", timeout: 15_000 });
  const upload = async (file) => {
    const chooser = page.waitForEvent("filechooser");
    await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
    await (await chooser).setFiles(file);
  };
  await upload(path.join(here, "fixtures", "test-pattern.webm"));
  const video = qt.locator("video.mac-quicktime-player-video");
  const measured = async (test) => {
    let now = false;
    await until(async () => {
      const read = await video.evaluate((each) => ({
        length: each.duration,
        width: each.videoWidth,
        height: each.videoHeight,
      }));
      if (Number.isFinite(read.length) && read.length > 0 && test(read)) now = read;
      return now;
    }, 60_000);
    return now;
  };
  await measured(() => true);
  await chooseMenu(page, "File", "Open File…");
  const view = qt.getByRole("combobox", { name: "View" }).first();
  const chooseView = async (name) => {
    await view.click();
    await page.getByRole("option", { name, exact: true }).click();
  };
  await qt
    .getByRole("option", { name: /test-pattern/ })
    .first()
    .waitFor({ timeout: 10_000 });

  // ---- As Columns and as Gallery --------------------------------------------------------------
  const pictured = async () =>
    until(
      async () =>
        qt
          .locator("video.mac-quicktime-player-preview-video")
          .evaluate((each) => each.videoWidth > 0 && each.readyState >= 2),
      20_000,
    );
  const openButton = qt.getByRole("button", { name: "Open", exact: true });
  await chooseView("as Columns");
  step(
    "as Columns has no Date Modified heading",
    await until(async () => (await qt.getByText("Date Modified").count()) === 0, 3_000),
  );
  await qt
    .getByRole("option", { name: /test-pattern/ })
    .first()
    .click();
  step("a movie chosen in a column shows its own picture", await pictured());
  step("and the window can open it", await openButton.isEnabled());
  await shot(page, path.join(out, "batch3-qt-columns.png"));
  await chooseView("as Gallery");
  await qt
    .getByRole("option", { name: /test-pattern/ })
    .first()
    .click();
  step("as Gallery, the movie chosen shows its picture over the strip", await pictured());
  await shot(page, path.join(out, "batch3-qt-gallery.png"));
  await chooseView("as List");

  // ---- Export As: a portrait movie of 2160 made in the page, read back at each size --------------
  const tall = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1216;
    canvas.height = 2160;
    const draw = canvas.getContext("2d");
    const recorder = new MediaRecorder(canvas.captureStream(10), { mimeType: "video/webm" });
    const pieces = [];
    recorder.ondataavailable = (event) => pieces.push(event.data);
    const ended = new Promise((done) => {
      recorder.onstop = done;
    });
    recorder.start();
    const painting = setInterval(() => {
      draw.fillStyle = `hsl(${Date.now() % 360} 80% 50%)`;
      draw.fillRect(0, 0, 1216, 2160);
    }, 100);
    await new Promise((done) => setTimeout(done, 1_500));
    recorder.stop();
    await ended;
    clearInterval(painting);
    const bytes = new Uint8Array(await new Blob(pieces).arrayBuffer());
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  });
  await upload({
    name: "tall.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(tall, "base64"),
  });
  await measured((now) => now.height === 2160);
  const idle = () =>
    qt
      .locator(".mac-quicktime-player-work")
      .getByRole("progressbar")
      .waitFor({ state: "detached", timeout: 120_000 });
  await idle();
  const movieEntries = async () =>
    ((await api(page, "GET", "/api/files/")).json?.entries ?? []).filter(
      (each) => each.trashed_ms == null && /\.(webm|mp4|m4a|mov)$/.test(each.name ?? ""),
    );
  const sizes = [
    ["4K", 2160],
    ["720p", 720],
    ["480p", 480],
  ];
  for (const [label, height] of sizes) {
    const before = new Set((await movieEntries()).map((each) => each.id));
    await chooseMenu(page, "File", "Export As", label);
    let made = null;
    await until(async () => {
      made = (await movieEntries()).find(
        (each) => !before.has(each.id) && each.name.includes(label),
      );
      return Boolean(made);
    }, 120_000);
    await idle();
    const read = made
      ? await page.evaluate(async (id) => {
          const answer = await fetch(`/api/files/content/${id}`, { credentials: "same-origin" });
          const media = document.createElement("video");
          media.src = URL.createObjectURL(await answer.blob());
          await new Promise((done, fail) => {
            media.onloadedmetadata = done;
            media.onerror = fail;
          });
          return { width: media.videoWidth, height: media.videoHeight };
        }, made.id)
      : null;
    step(
      `Export As > ${label} leaves a file in Movies ${height} high, in the movie's proportion`,
      read?.height === height && Math.abs(read.width - (1216 * height) / 2160) <= 2,
      JSON.stringify({ name: made?.name, read }),
    );
  }

  // ---- Recording quality: Maximum makes more bytes than High -----------------------------------
  const takeOf = async (quality) => {
    const before = new Set((await movieEntries()).map((each) => each.id));
    await chooseMenu(page, "File", "New Movie Recording");
    const options = qt.getByRole("button", { name: "Recording Options" });
    await options.waitFor({ timeout: 15_000 });
    await options.click();
    await page.getByRole("menuitemradio", { name: quality, exact: true }).click();
    await page.keyboard.press("Escape");
    const record = qt.getByRole("button", { name: "Start Recording", exact: true });
    await record.click();
    await sleep(4_000);
    await qt.getByRole("button", { name: "Stop Recording", exact: true }).click();
    let made = null;
    await until(async () => {
      made = (await movieEntries()).find((each) => !before.has(each.id));
      return Boolean(made);
    }, 60_000);
    await measured(() => true);
    await sleep(300);
    await chooseMenu(page, "File", "Open File…").catch(() => undefined);
    return made?.size ?? 0;
  };
  const high = await takeOf("High");
  const maximum = await takeOf("Maximum");
  step(
    "a Maximum take of a noisy picture is larger than a High one of the same length",
    high > 0 && maximum > high,
    `High ${high} bytes, Maximum ${maximum} bytes`,
  );
}

async function voicePart(page) {
  await install(page, "voice-memos");
  await launch(page, "Notes");
  const notes = page.locator('.mac-managed-window[data-window-id^="notes"]').first();
  await notes.waitFor({ state: "visible", timeout: 15_000 });
  await spotlight(page, "Voice Memos");
  const memos = page.locator('.mac-managed-window[data-window-id^="voice-memos"]').first();
  await memos.waitFor({ state: "visible", timeout: 15_000 });
  await memos.getByRole("button", { name: "New Recording" }).click();
  await memos.getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
  await sleep(2_000);
  await memos.getByRole("button", { name: "Done" }).click();
  const row = memos.getByRole("option", { name: /^New Recording/ }).first();
  await row.waitFor({ timeout: 15_000 });
  const fileName = await until(async () =>
    ((await api(page, "GET", "/api/files/")).json?.entries ?? []).some((each) =>
      /^New Recording/.test(each.name ?? ""),
    ),
  );
  step("a recording is on the drive", fileName);
  const noteFiles = async () => {
    const data = (await api(page, "GET", "/api/notes/data")).json?.data;
    return (data?.notes ?? []).flatMap((note) => note.files ?? []);
  };
  const soundFiles = async () => (await noteFiles()).filter((each) => /^audio\//.test(each.type));

  // ---- Share > Notes -------------------------------------------------------------------------
  await row.click();
  await chooseMenu(page, "File", "Share", "Notes");
  const shared = await until(async () => (await soundFiles()).length === 1, 15_000);
  step(
    "Share > Notes puts the recording in a note, read back from Notes' data",
    shared,
    JSON.stringify(await soundFiles()),
  );
  step(
    "and the note shows a player for it",
    await until(() => notes.locator("audio").first().isVisible(), 10_000),
  );
  await shot(page, path.join(out, "batch3-vm-notes-share.png"));

  // ---- A drag onto Notes -----------------------------------------------------------------------
  await spotlight(page, "Voice Memos");
  const memoBox = await memos.boundingBox();
  const notesBox = await notes.boundingBox();
  const visible = [
    { x: notesBox.x + notesBox.width - 30, y: notesBox.y + notesBox.height - 30 },
    { x: notesBox.x + 30, y: notesBox.y + notesBox.height - 30 },
    { x: notesBox.x + notesBox.width - 30, y: notesBox.y + 60 },
  ].find(
    (spot) =>
      spot.x < memoBox.x ||
      spot.x > memoBox.x + memoBox.width ||
      spot.y < memoBox.y ||
      spot.y > memoBox.y + memoBox.height,
  );
  const from = await row.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 4, { steps: 3 });
  await page.mouse.move(visible.x, visible.y, { steps: 8 });
  await page.mouse.up();
  step(
    "a recording dragged onto Notes is attached too",
    await until(async () => (await soundFiles()).length === 2, 15_000),
    JSON.stringify(await soundFiles()),
  );

  // ---- Spotlight -------------------------------------------------------------------------------
  await page.getByRole("menuitem", { name: "Spotlight" }).first().click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("New Recording");
  const found = page
    .getByRole("group", { name: /^(?:Files|Top Hit)$/ })
    .getByRole("option", { name: /^New Recording/ })
    .first();
  step(
    "Spotlight lists the recording by name",
    await found
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false),
  );
  await shot(page, path.join(out, "batch3-vm-spotlight.png"));
  await page.keyboard.press("Escape");
}

await run(async (page) => {
  await page.addInitScript(WATCH_SOUND);
  await openDesktop(page, base, step);
  if (wanted("music")) await musicPart(page);
  if (wanted("quicktime")) await quicktimePart(page);
  if (wanted("voice")) await voicePart(page);
});

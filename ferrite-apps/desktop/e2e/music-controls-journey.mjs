#!/usr/bin/env node
// Music's library and playback controls on Ferrite, each checked on the server and, for playback,
// on the media element itself (`window.__ws6Media`: currentTime, paused, volume, src), never on
// the window alone:
//
// - import: two songs chosen at once in Add Songs…, and a third dropped on the window (a drop
//   event whose DataTransfer carries a real File);
// - playlists: New Playlist, Add to Playlist into it, Rename, Remove from Playlist, and a second
//   playlist made and deleted; Loved: two songs loved, one of them unloved again;
// - playback: Play, the volume slider (the element's volume follows it), Next, Previous, seeking,
//   Repeat One (the song plays again from its start when it ends, and the play is counted),
//   Repeat All, Shuffle, and the keyboard (Space with the song list focused pauses and plays,
//   Control-Right plays the next song);
// - after a reload, every one of these is still there: the library, the renamed playlist and what
//   it holds, Loved, Top 25 Most Played, Shuffle, Repeat and the volume, and Play plays at the
//   volume kept (read from the element); another browser's session has none of it.
//
// `--phase set --state <file>` stops before the reload and keeps the browser's cookies (and what
// the run made, in <file>.made.json) for a restart of `ferrite dev` on the same data root;
// `--phase check --state <file>` then opens the desktop with those cookies, checks everything
// after the restart, and removes what the run made. Exits 0 only when every step passed and the
// page logged no console error, page error, failed request or HTTP error.
//
//   ferrite dev --fresh                                 # in ferrite-apps/desktop
//   node e2e/music-controls-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//        [--browser chromium|chrome|firefox|webkit] [--phase full|set|check] [--state <file>]

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const LIBRARY = "/api/music/library";
const PLAYBACK = "/api/music/playback";
const PREFERENCES = "/api/music/preferences";
const ARTIST = "The Control Room";
const ALBUM = "Switchboard";
/** Each song's length, in seconds: long enough that none ends while a step runs. */
const SECONDS = 12;
const SONGS = [
  { name: "control-alpha.wav", title: "Signal Alpha", track: 1, hz: 330 },
  { name: "control-bravo.wav", title: "Signal Bravo", track: 2, hz: 440 },
  { name: "control-charlie.wav", title: "Signal Charlie", track: 3, hz: 550 },
];
const [ALPHA, BRAVO, CHARLIE] = SONGS;
const MIX = "Road Mix";

const { base, out, browserName } = options();
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};
const phase = option("--phase", "full");
if (!["full", "set", "check"].includes(phase)) {
  console.error("--phase must be full, set or check");
  process.exit(2);
}
const stateFile = path.resolve(
  option("--state", path.join(out, `music-controls-${browserName}.state.json`)),
);
const madeFile = `${stateFile}.made.json`;
const kept = { storageState: stateFile };
const { step, run } = journey("music-controls", {
  ignoreOtherOrigins: true,
  contextOptions: phase === "check" ? { chromium: kept, firefox: kept, webkit: kept } : {},
});

/** A mono 16-bit WAV of a soft tone with a RIFF INFO list naming it. */
function toneWav({ title, track, hz }) {
  const rate = 22_050;
  const samples = rate * SECONDS;
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 3000), i * 2);
  }
  const sub = (id, text) => {
    const value = Buffer.from(`${text}\0`, "utf8");
    const pad = value.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
    const head = Buffer.alloc(8);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(value.length, 4);
    return Buffer.concat([head, value, pad]);
  };
  const chunk = (id, body) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
  };
  const info = Buffer.concat([
    Buffer.from("INFO"),
    sub("INAM", title),
    sub("IART", ARTIST),
    sub("IPRD", ALBUM),
    sub("ITRK", String(track)),
  ]);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
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

/**
 * An init script that keeps every media element the page plays in `window.__ws6Media`, so a step
 * can read the element's own state rather than what the window shows. Music's player is an
 * `Audio` that is never put in the document.
 */
function recordMedia() {
  const seen = [];
  Object.defineProperty(window, "__ws6Media", { value: seen });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...rest) {
    if (!seen.includes(this)) seen.push(this);
    return play.apply(this, rest);
  };
}

/** The newest media element of `page` as it is now. */
const mediaNow = (page) =>
  page.evaluate(() => {
    const media = window.__ws6Media?.at(-1);
    return media
      ? {
          paused: media.paused,
          at: media.currentTime,
          duration: media.duration,
          volume: media.volume,
          src: media.getAttribute("src"),
        }
      : { paused: true, at: 0, duration: Number.NaN, volume: 1, src: null };
  });

/**
 * Wait until the newest media element plays past `past` seconds, with its source not `not`, or
 * exactly `is`, when given, within `timeout` ms; resolves with its state.
 */
async function playing(page, { past = 0.3, not = null, is = null, timeout = 30_000 } = {}) {
  await page.waitForFunction(
    ({ past, not, is }) => {
      const media = window.__ws6Media?.at(-1);
      if (!media || media.paused || media.currentTime <= past) return false;
      const src = media.getAttribute("src");
      return (not === null || src !== not) && (is === null || src === is);
    },
    { past, not, is },
    { timeout },
  );
  return mediaNow(page);
}

/** A wait for the media element as an outcome: `ok` with its state, or not `ok` when it timed
 * out, so a step records the failure rather than accepting another state. */
const outcome = (wait) =>
  wait.then(
    (media) => ({ ok: true, ...media }),
    () => ({ ok: false, paused: true, at: 0, src: null }),
  );

/** Read a document from the server until `accept` holds for it; resolves with it. */
async function until(page, url, field, accept, what) {
  let last;
  for (let waited = 0; waited <= 30_000; waited += 250) {
    last = (await api(page, "GET", url)).json?.[field];
    if (last && accept(last)) return last;
    await page.waitForTimeout(250);
  }
  throw new Error(`the server never held ${what}: ${JSON.stringify(last)?.slice(0, 300)}`);
}
const libraryUntil = (page, accept, what) => until(page, LIBRARY, "library", accept, what);
const playbackUntil = (page, accept, what) => until(page, PLAYBACK, "playback", accept, what);

async function openMusic(page) {
  await launch(page, "Music");
  const window = page.getByRole("region", { name: "Music", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  return window;
}

const place = (window, name) =>
  window.getByRole("tree", { name: "Music" }).getByRole("treeitem", { name, exact: true });
const controls = (window) => window.getByRole("toolbar", { name: "Playback controls" });
const transport = (window, name) => controls(window).getByRole("button", { name, exact: true });
const repeatButton = (window) => controls(window).getByRole("button", { name: /^Repeat: / });
const songRow = (scope, title) => scope.getByRole("row", { name: new RegExp(title) }).first();

/** Open a song's context menu and choose `path` (a submenu's title, then its item). */
async function songMenu(page, window, title, ...path) {
  await songRow(window, title).click({ button: "right" });
  for (const [n, item] of path.entries()) {
    const entry = page.getByRole("menuitem", { name: item, exact: true });
    if (n < path.length - 1) await entry.hover();
    else await entry.click();
  }
}

/** Music's reads and saves of its documents under way, and when the last started or ended. */
const openRequests = new Set();
let lastActivity = 0;
function followSaves(page) {
  const music = (request) =>
    /^\/api\/music\/(library|playback|preferences)$/.test(
      new globalThis.URL(request.url()).pathname,
    );
  const done = (request) => {
    if (openRequests.delete(request)) lastActivity = Date.now();
  };
  page.on("request", (request) => {
    if (!music(request)) return;
    openRequests.add(request);
    lastActivity = Date.now();
  });
  page.on("requestfinished", done);
  page.on("requestfailed", (request) => {
    done(request);
    // In order with the steps, so that a failure is placed: which request, and when.
    if (music(request)) {
      const where = new globalThis.URL(request.url()).pathname;
      console.log(`note: ${request.method()} ${where} failed: ${request.failure()?.errorText}`);
    }
  });
  page.on("pageerror", (error) => console.log(`note: page error: ${error.message}`));
}

/** Wait until Music has been quiet for 1.5 s: no read or save of its documents under way. */
async function settled(page) {
  for (let waited = 0; ; waited += 100) {
    if (openRequests.size === 0 && Date.now() - lastActivity >= 1_500) return;
    if (waited >= 30_000)
      throw new Error(`${openRequests.size} Music request(s) still under way after 30 s`);
    await page.waitForTimeout(100);
  }
}

/** Import, edit the library, and use every playback control; `made` names what it put where. */
async function build(page, made) {
  for (const url of [LIBRARY, PLAYBACK, PREFERENCES]) await api(page, "DELETE", url);
  await reloadDesktop(page);
  const window = await openMusic(page);
  step(
    "Music opens with an empty library",
    await window.getByText("Your library is empty.").isVisible(),
  );

  // ---- Import: two chosen at once, one dropped ----------------------------------------------
  const files = SONGS.map((song) => {
    const file = path.join(out, song.name);
    writeFileSync(file, toneWav(song));
    return file;
  });
  await window
    .locator('input[type="file"][aria-label="Add to Library"]')
    .setInputFiles(files.slice(0, 2));
  let library = await libraryUntil(
    page,
    (l) => [ALPHA, BRAVO].every((s) => l.songs.some((x) => x.title === s.title)),
    "the two songs chosen",
  );
  made.files = library.songs.map((song) => song.source?.file).filter(Boolean);
  step(
    "two songs chosen at once in Add Songs… are uploaded to the drive and listed",
    [ALPHA, BRAVO].every(
      (s) => library.songs.find((x) => x.title === s.title)?.source?.kind === "file",
    ),
    `${library.songs.length} songs`,
  );
  const dropped = await page.evaluateHandle(
    ({ name, data }) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type: "audio/wav" }));
      return transfer;
    },
    { name: CHARLIE.name, data: toneWav(CHARLIE).toString("base64") },
  );
  for (const type of ["dragenter", "dragover", "drop"]) {
    await window.dispatchEvent(type, { dataTransfer: dropped });
  }
  library = await libraryUntil(
    page,
    (l) => l.songs.some((x) => x.title === CHARLIE.title),
    "the song dropped",
  );
  made.files = library.songs.map((song) => song.source?.file).filter(Boolean);
  const charlie = library.songs.find((x) => x.title === CHARLIE.title);
  step(
    "a song dropped on the window is uploaded to the drive and listed, its length read",
    charlie?.source?.kind === "file" && Math.abs(charlie.duration - SECONDS) < 0.5,
    `${charlie?.source?.name} ${charlie?.duration} s`,
  );
  const id = Object.fromEntries(
    SONGS.map((s) => [s.title, library.songs.find((x) => x.title === s.title)?.id]),
  );
  made.ids = id;

  // ---- Playlists ---------------------------------------------------------------------------
  await place(window, "Songs").click();
  await songMenu(page, window, ALPHA.title, "Add to Playlist", "New Playlist");
  await libraryUntil(
    page,
    (l) => l.playlists.some((p) => p.songs.join() === id[ALPHA.title]),
    "a playlist holding Alpha",
  );
  await place(window, "Songs").click();
  await songMenu(page, window, BRAVO.title, "Add to Playlist", "Untitled Playlist");
  await libraryUntil(
    page,
    (l) => l.playlists.some((p) => p.songs.join() === [id[ALPHA.title], id[BRAVO.title]].join()),
    "Alpha and Bravo in the playlist",
  );
  await place(window, "Untitled Playlist").click();
  await window.getByRole("button", { name: "Rename", exact: true }).click();
  const field = window.getByRole("textbox", { name: "Playlist name" });
  await field.fill(MIX);
  await field.press("Enter");
  library = await libraryUntil(
    page,
    (l) => l.playlists.some((p) => p.name === MIX),
    "the playlist renamed",
  );
  step(
    "New Playlist, Add to Playlist and Rename are kept: Road Mix holds Alpha and Bravo",
    library.playlists.find((p) => p.name === MIX)?.songs.join() ===
      [id[ALPHA.title], id[BRAVO.title]].join() && (await place(window, MIX).isVisible()),
  );
  await songMenu(page, window, ALPHA.title, "Remove from Playlist");
  library = await libraryUntil(
    page,
    (l) => l.playlists.find((p) => p.name === MIX)?.songs.join() === id[BRAVO.title],
    "Alpha taken out of Road Mix",
  );
  step(
    "Remove from Playlist is kept, and the song stays in the library",
    library.songs.some((s) => s.id === id[ALPHA.title]),
  );
  await place(window, "Songs").click();
  await songMenu(page, window, CHARLIE.title, "Add to Playlist", "New Playlist");
  await libraryUntil(page, (l) => l.playlists.length === 2, "a second playlist");
  await window.getByRole("button", { name: "Delete Playlist", exact: true }).click();
  library = await libraryUntil(
    page,
    (l) => l.playlists.length === 1 && l.playlists[0].name === MIX,
    "the second playlist deleted",
  );
  step(
    "a second playlist is made, and Delete Playlist takes it off the server and the sidebar",
    (await place(window, "Untitled Playlist").count()) === 0,
  );

  // ---- Loved -------------------------------------------------------------------------------
  await place(window, "Songs").click();
  await window.getByRole("button", { name: `Love ${ALPHA.title}` }).click();
  await window.getByRole("button", { name: `Love ${CHARLIE.title}` }).click();
  await libraryUntil(page, (l) => l.loved.length === 2, "two songs loved");
  await window.getByRole("button", { name: `Unlove ${CHARLIE.title}` }).click();
  library = await libraryUntil(page, (l) => l.loved.join() === id[ALPHA.title], "Charlie unloved");
  step("Love and Unlove are kept: Loved holds Alpha only", true);

  // ---- Playback, read from the media element -------------------------------------------------
  const lcd = window.getByRole("group", { name: "Now Playing" }).first();
  await songRow(window, ALPHA.title).dblclick();
  await lcd.getByText(ALPHA.title).waitFor({ timeout: 15_000 });
  const first = await playing(page);
  const alphaSrc = first.src;
  step(
    "Play: Alpha's media element advances, its decoded length the song's",
    !first.paused && Math.abs(first.duration - SECONDS) < 0.5,
    `${first.at.toFixed(2)} s of ${first.duration.toFixed(2)} s`,
  );

  const volume = window.getByRole("slider", { name: "Volume" });
  await volume.focus();
  await volume.press("Home");
  for (let n = 0; n < 3; n += 1) await volume.press("PageUp");
  for (let n = 0; n < 40; n += 1) {
    const shown = Number(await volume.getAttribute("aria-valuenow"));
    if (shown === 30) break;
    await volume.press(shown < 30 ? "ArrowRight" : "ArrowLeft");
  }
  await playbackUntil(page, (p) => p.volume === 30, "the volume at 30");
  const heardVolume = (await mediaNow(page)).volume;
  step(
    "the volume slider sets the media element's volume to 0.3, and 30 is kept",
    Math.abs(heardVolume - 0.3) < 0.011,
    `element volume ${heardVolume}`,
  );
  const output = controls(window).getByRole("button", { name: "Audio output" });
  const outputReason = (await output.getAttribute("title")) ?? "";
  step(
    "the Audio output button works, or says why it cannot in this browser",
    ((await output.getAttribute("aria-disabled")) !== "true" && !(await output.isDisabled())) ||
      /isn’t available here/.test(outputReason),
    outputReason,
  );

  await transport(window, "Next").click();
  await lcd.getByText(BRAVO.title).waitFor({ timeout: 15_000 });
  const second = await playing(page, { not: alphaSrc });
  step(
    "Next plays Bravo: the media element's source changes and it advances",
    second.src !== alphaSrc && !second.paused,
    `${second.at.toFixed(2)} s`,
  );
  await transport(window, "Previous").click();
  await lcd.getByText(ALPHA.title).waitFor({ timeout: 15_000 });
  const back = await playing(page, { is: alphaSrc });
  step(
    "Previous, early in a song, plays the one before: Alpha's source again, advancing",
    back.src === alphaSrc && !back.paused,
    `${back.at.toFixed(2)} s`,
  );

  const repeat = repeatButton(window);
  await repeat.click();
  await repeat.click();
  await page.evaluate(() => {
    const media = window.__ws6Media.at(-1);
    window.__ws6Ends = 0;
    media.addEventListener("ended", () => {
      window.__ws6Ends += 1;
    });
  });
  const knob = lcd.getByRole("slider", { name: "Playback position" });
  await knob.focus();
  await knob.press("Home");
  for (let n = 0; n < SECONDS - 3; n += 1) await knob.press("ArrowRight");
  const sought = await mediaNow(page);
  await playbackUntil(
    page,
    (p) => Math.abs(p.position - (SECONDS - 3)) < 1.5,
    `the place 0:0${SECONDS - 3}`,
  );
  step(
    `seeking moves the media element to 0:0${SECONDS - 3}, and the place is kept`,
    sought.at >= SECONDS - 3.5 && sought.at < SECONDS,
    `${sought.at.toFixed(2)} s`,
  );
  await page.waitForFunction(
    () => {
      const media = window.__ws6Media.at(-1);
      return (
        window.__ws6Ends >= 1 && !media.paused && media.currentTime > 0.3 && media.currentTime < 6
      );
    },
    null,
    { timeout: 30_000 },
  );
  const again = await mediaNow(page);
  await playbackUntil(page, (p) => (p.plays?.[id[ALPHA.title]] ?? 0) >= 1, "Alpha's play counted");
  step(
    "Repeat One: when Alpha ends its media element plays it again from the start, and the play is counted",
    (await repeat.getAttribute("aria-label")) === "Repeat: One" &&
      again.src === alphaSrc &&
      (await lcd.getByText(ALPHA.title).isVisible()),
    `${again.at.toFixed(2)} s`,
  );

  await repeat.click();
  await repeat.click();
  await transport(window, "Shuffle").click();
  await playbackUntil(
    page,
    (p) => p.repeat === "all" && p.shuffle && p.unshuffled.length === 3,
    "Repeat All and Shuffle",
  );
  const still = await playing(page, { is: alphaSrc });
  step(
    "Repeat All and Shuffle are kept, and turning Shuffle on leaves the song playing",
    (await repeat.getAttribute("aria-label")) === "Repeat: All" &&
      (await transport(window, "Shuffle").getAttribute("aria-pressed")) === "true" &&
      !still.paused,
  );

  // ---- The keyboard --------------------------------------------------------------------------
  // Each key's effect must show on the media element within 5 s, so that nothing else (a song
  // ending on its own) can pass for it. The row selected is the song playing: paused, Play starts
  // at a selection elsewhere instead of going on.
  await songRow(window, ALPHA.title).click();
  await page.keyboard.press("Space");
  const pausedByKey = await page
    .waitForFunction(() => window.__ws6Media.at(-1).paused, null, { timeout: 5_000 })
    .then(
      () => true,
      () => false,
    );
  const pausedAt = (await mediaNow(page)).at;
  step("Space with the song list focused pauses: the media element is paused", pausedByKey);
  await page.keyboard.press("Space");
  const resumedByKey = await outcome(
    playing(page, { is: alphaSrc, past: pausedAt + 0.3, timeout: 5_000 }),
  );
  step(
    "and Space plays again: the same media element goes on from where it paused",
    resumedByKey.ok,
    `paused at ${pausedAt.toFixed(2)} s, then ${resumedByKey.at.toFixed(2)} s`,
  );
  // From Alpha's start, with the song list focused again, so that only the key can end Alpha
  // within the wait; no `ended` may be heard meanwhile.
  await knob.focus();
  await knob.press("Home");
  await songRow(window, BRAVO.title).click();
  const endsBefore = await page.evaluate(() => window.__ws6Ends);
  await page.keyboard.press("Control+ArrowRight");
  const nextByKey = await outcome(playing(page, { not: alphaSrc, timeout: 5_000 }));
  const endsAfter = await page.evaluate(() => window.__ws6Ends);
  step(
    "Control-Right plays the next song at once: within 5 s, with no song ending, the media element's source changes and it advances",
    nextByKey.ok && endsAfter === endsBefore,
    `${nextByKey.at.toFixed(2)} s, ended ${endsBefore} then ${endsAfter}`,
  );
  await transport(window, "Pause").click();
}

/** Everything `build` did, read back from the server, the window and the media element. */
async function checkKept(page, made, when) {
  const window = await openMusic(page);
  const id = made.ids;
  const library = (await api(page, "GET", LIBRARY)).json.library;
  const playback = (await api(page, "GET", PLAYBACK)).json.playback;
  const mix = library?.playlists?.find((p) => p.name === MIX);
  step(
    `${when}, the server holds the library: three songs, Road Mix holding Bravo, Loved holding Alpha`,
    library?.songs?.length === 3 &&
      library.playlists.length === 1 &&
      mix?.songs?.join() === id[BRAVO.title] &&
      library.loved.join() === id[ALPHA.title],
    JSON.stringify({
      songs: library?.songs?.length,
      playlists: library?.playlists?.map((p) => p.name),
      loved: library?.loved?.length,
    }),
  );
  step(
    `${when}, the server holds Shuffle on, Repeat All, volume 30 and Alpha's play`,
    playback?.shuffle === true &&
      playback.repeat === "all" &&
      playback.volume === 30 &&
      (playback.plays?.[id[ALPHA.title]] ?? 0) >= 1,
    JSON.stringify({
      shuffle: playback?.shuffle,
      repeat: playback?.repeat,
      volume: playback?.volume,
    }),
  );
  const shuffle = await transport(window, "Shuffle").getAttribute("aria-pressed");
  const repeatLabel = await repeatButton(window).getAttribute("aria-label");
  const shownVolume = await window
    .getByRole("slider", { name: "Volume" })
    .getAttribute("aria-valuenow");
  step(
    `${when}, the window shows them: Shuffle on, Repeat All, the volume at 30`,
    shuffle === "true" && repeatLabel === "Repeat: All" && shownVolume === "30",
    `${shuffle}, ${repeatLabel}, ${shownVolume}`,
  );
  await place(window, MIX).click();
  const mixGrid = window.getByRole("grid", { name: MIX });
  const mixBravo = await mixGrid.getByRole("row", { name: new RegExp(BRAVO.title) }).count();
  const mixAlpha = await mixGrid.getByRole("row", { name: new RegExp(ALPHA.title) }).count();
  await place(window, "Loved Songs").click();
  const lovedGrid = window.getByRole("grid", { name: "Loved Songs" });
  const lovedAlpha = await lovedGrid.getByRole("row", { name: new RegExp(ALPHA.title) }).count();
  const lovedCharlie = await lovedGrid
    .getByRole("row", { name: new RegExp(CHARLIE.title) })
    .count();
  await place(window, "Top 25 Most Played").click();
  const topAlpha = await window
    .getByRole("grid", { name: "Top 25 Most Played" })
    .getByRole("row", { name: new RegExp(ALPHA.title) })
    .count();
  step(
    `${when}, Road Mix shows Bravo only, Loved Songs Alpha only, Top 25 Most Played lists Alpha`,
    mixBravo === 1 &&
      mixAlpha === 0 &&
      lovedAlpha === 1 &&
      lovedCharlie === 0 &&
      topAlpha === 1 &&
      (await place(window, "Untitled Playlist").count()) === 0,
    JSON.stringify({ mixBravo, mixAlpha, lovedAlpha, lovedCharlie, topAlpha }),
  );
  await transport(window, "Play").click();
  const heard = await playing(page);
  step(
    `${when}, Play plays at the volume kept: the media element's volume is 0.3 and it advances`,
    Math.abs(heard.volume - 0.3) < 0.011 && !heard.paused,
    `volume ${heard.volume}, ${heard.at.toFixed(2)} s`,
  );
  await transport(window, "Pause").click();
}

/** Another browser, a session of its own: none of this is there. */
async function nothingElsewhere(page) {
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const other = await context.newPage();
    await openDesktop(other, base, () => true);
    const theirs = (await api(other, "GET", LIBRARY)).json;
    const theirPlayback = (await api(other, "GET", PLAYBACK)).json;
    const window = await openMusic(other);
    const empty = await window.getByText("Your library is empty.").isVisible();
    step(
      "another browser's session has none of it: no library, no playback, an empty window",
      theirs.library === null && theirPlayback.playback === null && empty,
      `${JSON.stringify(theirs.library)} ${JSON.stringify(theirPlayback.playback)} empty ${empty}`,
    );
  } finally {
    await context.close();
  }
}

/** Take out what the run made: Music's documents and the song files it put in the drive. */
async function cleanUp(page, made) {
  await settled(page).catch(() => {});
  for (const url of [LIBRARY, PLAYBACK, PREFERENCES]) await api(page, "DELETE", url);
  for (const file of made.files ?? []) {
    const removed = await page.evaluate(async (fileId) => {
      const response = await fetch("/api/files/ops", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ ops: [{ op: "delete", id: fileId }] }),
      });
      return response.status;
    }, file);
    if (removed !== 200)
      throw new Error(`a song file the run made was not removed: HTTP ${removed}`);
  }
}

await run(async (page) => {
  followSaves(page);
  await page.addInitScript(recordMedia);
  await openDesktop(page, base, step);
  const made = phase === "check" ? JSON.parse(readFileSync(madeFile, "utf8")) : {};
  let keep = false;
  try {
    if (phase === "check") {
      await checkKept(page, made, "after the restart");
      await nothingElsewhere(page);
    } else {
      await build(page, made);
      await settled(page);
      if (phase === "set") {
        await page.context().storageState({ path: stateFile });
        writeFileSync(madeFile, JSON.stringify(made));
        keep = true;
        step("the browser's cookies and what the run made are kept for the restart check", true);
      } else {
        await reloadDesktop(page);
        await checkKept(page, made, "after a reload");
        await nothingElsewhere(page);
      }
    }
    await shot(page, path.join(out, `music-controls-${browserName}-${phase}.png`));
  } finally {
    if (!keep) await cleanUp(page, made);
  }
});

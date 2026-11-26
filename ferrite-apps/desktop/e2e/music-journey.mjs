#!/usr/bin/env node
// Music on Ferrite: add a song from the computer (a 10-second WAV with its own tags, made here,
// larger than one request so the drive takes it in pieces), play it, pause, seek to 0:03 and
// play on from there, reload and play on from the place it was paused at, love it, put it in a
// new playlist, change the Preferences this desktop carries out (List Size, the song-change
// notification, the MiniPlayer kept on top) and find the others dimmed with the reason, then find
// openly licensed music on the Internet Archive, play a track from archive.org and add it to the
// library. After a reload the library, the playlist, Loved, Recently Played and the Preferences
// are all still there, the lists are drawn at the larger size, and the MiniPlayer stays above a
// window brought in front of it. Then a second tab plays the song while this page forgets the
// playback and the library: the other tab takes the forget up and goes on saving, its media
// element still playing, and shows the forgotten library without a reload. Exits 0 only when every
// step passed and the page logged no console error, page error, failed request or HTTP error.
//
// Firefox plays sound only with an audio output device; on a headless Linux host start one first
// (PulseAudio's null sink: `pulseaudio --start --exit-idle-time=-1`).
//
//   ferrite dev --egress allow                     # in ferrite-apps/desktop (the Archive search)
//   node e2e/music-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                              [--browser chromium|chrome|firefox|webkit] [--archive-query Subjectjazz]

import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { uploadFile } from "./system-kit.mjs";

const LIBRARY = "/api/music/library";
const PLAYBACK = "/api/music/playback";
const PREFERENCES = "/api/music/preferences";
const TITLE = "Journey Tone";
const ARTIST = "The Test Signals";
const ALBUM = "Ferrite Sessions";
const { base, out, browserName } = options();
const args = process.argv.slice(2);
const archiveQuery = args.includes("--archive-query")
  ? args[args.indexOf("--archive-query") + 1]
  : "Subjectjazz Saturne";
const { step, run } = journey("music", { ignoreOtherOrigins: true });

/** A mono 16-bit WAV of a soft 440 Hz tone with a RIFF INFO list naming it. */
function toneWav(seconds) {
  const rate = 22_050;
  const samples = rate * seconds;
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 3000), i * 2);
  }
  const sub = (id, text) => {
    const value = Buffer.from(`${text}\0`, "utf8");
    const pad = value.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
    const head = Buffer.alloc(8);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(value.length, 4);
    return Buffer.concat([head, value, pad]);
  };
  const info = Buffer.concat([
    Buffer.from("INFO"),
    sub("INAM", TITLE),
    sub("IART", ARTIST),
    sub("IPRD", ALBUM),
    sub("ITRK", "1"),
  ]);
  const chunk = (id, body) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
  };
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0); // PCM
  fmt.writeUInt16LE(1, 2); // mono
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const body = Buffer.concat([
    Buffer.from("WAVE"),
    chunk("fmt ", fmt),
    chunk("LIST", info),
    chunk("data", pcm),
  ]);
  return Buffer.concat([chunk("RIFF", body)]);
}

const nextSave = (page, url, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new globalThis.URL(response.url()).pathname === url &&
      accept(JSON.parse(response.request().postData() ?? "null")),
    { timeout: 30_000 },
  );

async function openMusic(page) {
  await launch(page, "Music");
  const window = page.getByRole("region", { name: "Music", exact: true }).first();
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

const place = (window, name) =>
  window.getByRole("tree", { name: "Music" }).getByRole("treeitem", { name, exact: true });

/** Open Music's Preferences from the application menu of the menu bar. */
async function openPreferences(page) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Music", exact: true })
    .click();
  await page.getByRole("menuitem", { name: /^Preferences…/ }).click();
  await page.getByRole("tablist", { name: "Music preferences" }).waitFor({ timeout: 10_000 });
}

/** Whether a check box is dimmed (Base UI marks it both ways). */
const dimmed = (box) =>
  box.evaluate(
    (element) =>
      element.getAttribute("aria-disabled") === "true" || element.hasAttribute("data-disabled"),
  );

/** The height of the first row of a song grid, in CSS pixels. */
const rowHeight = (grid) =>
  grid
    .getByRole("row")
    .last()
    .evaluate((row) => row.getBoundingClientRect().height);

/**
 * An init script that keeps every media element the page plays in `window.__ws6Media`, so a step
 * can read the element's own state (`currentTime`, `duration`, `paused`) rather than what the
 * window shows. Music's player is an `Audio` that is never put in the document.
 */
function recordMedia() {
  const seen = [];
  Object.defineProperty(window, "__ws6Media", { value: seen });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (!seen.includes(this)) seen.push(this);
    return play.apply(this, args);
  };
}

/** Wait until the newest media element of `page` plays past `seconds`; resolves with its state. */
async function mediaPast(page, seconds) {
  await page.waitForFunction(
    (at) => {
      const media = window.__ws6Media?.at(-1);
      return Boolean(media && !media.paused && media.currentTime > at);
    },
    seconds,
    { timeout: 30_000 },
  );
  return page.evaluate(() => {
    const media = window.__ws6Media.at(-1);
    return { at: media.currentTime, duration: media.duration, paused: media.paused };
  });
}

/** The next save of `url` that `page` makes and the server stores. */
const storedSave = (page, url) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new globalThis.URL(response.url()).pathname === url &&
      response.status() === 200,
    { timeout: 30_000 },
  );

/** The next playback save of `page` the server stores whose place is at least `seconds`: a
 * pause's own save, not one already on its way when the pause was pressed. */
const savedAtLeast = (page, seconds) =>
  page.waitForResponse(
    (response) => {
      if (
        response.request().method() !== "PUT" ||
        new globalThis.URL(response.url()).pathname !== PLAYBACK ||
        response.status() !== 200
      )
        return false;
      const body = JSON.parse(response.request().postData() ?? "null");
      return (body?.playback?.position ?? -1) >= seconds;
    },
    { timeout: 30_000 },
  );

/** The transport's Play (the album and playlist views have a Play button of their own). */
const transportPlay = (window) =>
  window
    .getByRole("toolbar", { name: "Playback controls" })
    .getByRole("button", { name: "Play", exact: true });

/** The newest media element of `page` as it is now. */
const mediaNow = (page) =>
  page.evaluate(() => {
    const media = window.__ws6Media?.at(-1);
    return media
      ? {
          played: true,
          paused: media.paused,
          at: media.currentTime,
          src: media.getAttribute("src"),
        }
      : { played: false, paused: true, at: 0, src: null };
  });

/** Whether the window shows nothing playing or loading: the transport offers Play and the
 * display says no Loading…. */
async function quiet(window) {
  const play = await transportPlay(window).isVisible();
  const loading = await window
    .getByRole("group", { name: "Now Playing" })
    .first()
    .getByText("Loading…")
    .count();
  return play && loading === 0;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The archive.org addresses a track's sound comes from (the download link and its data node). */
const ARCHIVE_SOUND = /^https:\/\/([a-z0-9-]+\.)*archive\.org\/(download|\d+\/items)\//;

/** What the window says when the Internet Archive did not give a track (archive.org's own
 * failures), as opposed to anything else. */
const ARCHIVE_FAILED = /didn’t give this song’s file|can’t be reached|stopped answering/;

/**
 * Wait for `playing()` (a promise of the track playing), unless the window first says the
 * Internet Archive did not give the track. archive.org's data nodes now and then answer 500 for a
 * file they hold; the window then says so and offers Play, which is pressed again, as the window
 * says to, at most three times, each logged. Anything else that goes wrong still fails the step.
 */
async function withArchiveRetries(window, playing) {
  const said = window.getByRole("alert").filter({ hasText: ARCHIVE_FAILED });
  for (let attempt = 1; ; attempt += 1) {
    const outcome = await Promise.race([
      playing().then(
        (value) => ({ played: true, value }),
        (error) => ({ played: false, error }),
      ),
      said.waitFor({ timeout: 30_000 }).then(
        () => ({ refused: true }),
        () => new Promise(() => {}),
      ),
    ]);
    if (outcome.played) return outcome.value;
    if (!outcome.refused) throw outcome.error;
    const text = ((await said.textContent()) ?? "").trim();
    if (attempt > 3)
      throw new Error(`archive.org did not give the track in ${attempt} tries: ${text}`);
    console.log(
      `note (archive.org, not counted): ${text} Pressing Play again (try ${attempt + 1}).`,
    );
    await window
      .locator(".mac-music-desktop-status")
      .getByRole("button", { name: "OK", exact: true })
      .click()
      .catch(() => {});
    await transportPlay(window).click();
  }
}

/** The position the server holds for the song loaded. */
async function storedPosition(page) {
  const stored = await api(page, "GET", PLAYBACK);
  return stored.json.playback?.position ?? -1;
}

/**
 * Wait until the position shown has reached `seconds`. A fixed wait is not enough: Firefox's
 * clock on PulseAudio's null sink can stand still for seconds before the sound starts.
 */
async function reached(page, lcd, seconds) {
  const knob = await lcd.getByRole("slider", { name: "Playback position" }).elementHandle();
  await page.waitForFunction(
    ([element, at]) => Number(element.getAttribute("aria-valuenow") ?? element.value) >= at,
    [knob, seconds],
    { timeout: 30_000 },
  );
}

/** The position the knob shows, in whole seconds (it steps by one). */
function shownPosition(lcd) {
  return lcd
    .getByRole("slider", { name: "Playback position" })
    .evaluate((element) => Number(element.getAttribute("aria-valuenow") ?? element.value));
}

/**
 * Click Play and follow the position shown until it is `seconds` past `from`; returns the lowest
 * position shown on the way. A song that started again at 0:00 instead of at `from` shows a
 * position under it before it gets there.
 */
async function playOnFrom(page, window, lcd, from, seconds) {
  await window.getByRole("button", { name: "Play", exact: true }).click();
  let lowest = Number.POSITIVE_INFINITY;
  for (let waited = 0; waited < 30_000; waited += 100) {
    const at = await shownPosition(lcd);
    lowest = Math.min(lowest, at);
    if (at >= from + seconds) return lowest;
    await page.waitForTimeout(100);
  }
  throw new Error(`the position shown did not reach ${from + seconds} s within 30 s`);
}

/** Pause and wait for the save the pause starts, then read what the server holds. */
async function pauseAndSave(page, window) {
  // Listening from the moment of the click: the save the pause gives is the first one sent
  // after it (a save waiting to be grouped is replaced by it, not sent besides it).
  let clicked = false;
  const sent = page.waitForRequest(
    (request) =>
      clicked &&
      request.method() === "PUT" &&
      new globalThis.URL(request.url()).pathname === PLAYBACK,
    { timeout: 10_000 },
  );
  clicked = true;
  await window.getByRole("button", { name: "Pause" }).click();
  const request = await sent;
  await request.response();
  return storedPosition(page);
}

/** Music's requests for its documents under way, followed from the start of the run, and when
 * the last one started or ended. */
const openRequests = new Set();
let lastActivity = 0;
function followSaves(page) {
  const music = (request) =>
    /^\/api\/music\/(library|playback)$/.test(new globalThis.URL(request.url()).pathname);
  const done = (request) => {
    if (openRequests.delete(request)) lastActivity = Date.now();
  };
  page.on("request", (request) => {
    if (!music(request)) return;
    openRequests.add(request);
    lastActivity = Date.now();
  });
  page.on("requestfinished", done);
  page.on("requestfailed", done);
}

/**
 * Wait until Music has been quiet for 1.5 s: no read or save of its documents under way, and
 * none started or ended. Saves are grouped for 400 ms, and a read can be followed by a save; a
 * reload before they are done makes the page send the waiting one as it goes, which WebKit
 * cancels.
 */
async function settled(page) {
  for (let waited = 0; ; waited += 100) {
    if (openRequests.size === 0 && Date.now() - lastActivity >= 1_500) return;
    if (waited >= 30_000)
      throw new Error(`${openRequests.size} Music request(s) still under way after 30 s`);
    await page.waitForTimeout(100);
  }
}

/** Take out what the run made: Music's documents and the song file it put in the drive. */
async function cleanUp(page, made) {
  await settled(page);
  await api(page, "DELETE", LIBRARY);
  await api(page, "DELETE", PLAYBACK);
  await api(page, "DELETE", PREFERENCES);
  const files = [made.file, made.broken].filter(Boolean);
  for (const id of files) {
    const removed = await page.evaluate(async (fileId) => {
      const response = await fetch("/api/files/ops", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ ops: [{ op: "delete", id: fileId }] }),
      });
      return response.status;
    }, id);
    if (removed !== 200)
      throw new Error(`a song file the run made was not removed: HTTP ${removed}`);
  }
}

async function steps(page, made) {
  followSaves(page);
  await page.addInitScript(recordMedia);
  await openDesktop(page, base, step);
  await api(page, "DELETE", LIBRARY);
  await api(page, "DELETE", PLAYBACK);
  await api(page, "DELETE", PREFERENCES);
  await reloadDesktop(page);

  let window = await openMusic(page);
  step("Music opens from the Dock", await window.isVisible());

  // ---- Add a song from the computer -----------------------------------------------------
  const file = path.join(out, "music-journey-tone.wav");
  writeFileSync(file, toneWav(10));
  const pieces = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      /\/api\/files\/uploads\/[^/]+\/\d+$/.test(new globalThis.URL(request.url()).pathname)
    ) {
      pieces.push(request.postDataBuffer()?.length ?? 0);
    }
  });
  const added = nextSave(page, LIBRARY, (body) =>
    body?.library?.songs?.some((song) => song.title === TITLE),
  );
  await window.locator('input[type="file"][aria-label="Add to Library"]').setInputFiles(file);
  await added;
  // What the server keeps, not what the page sent.
  const kept = await api(page, "GET", LIBRARY);
  const song = kept.json.library?.songs?.find((entry) => entry.title === TITLE);
  made.file = song?.source?.file;
  step(
    "the song is uploaded to the drive in pieces under the request limit",
    pieces.length >= 2 && pieces.every((size) => size > 0 && size <= 262_144),
    `${pieces.length} pieces`,
  );
  step(
    "its tags were read: title, artist, album, track and length",
    song?.artist === ARTIST &&
      song?.album === ALBUM &&
      song?.track === 1 &&
      Math.abs(song.duration - 10) < 0.5,
    `${song?.artist} / ${song?.album} / ${song?.duration}`,
  );
  step(
    "the library names the drive file",
    song?.source?.kind === "file" && typeof song.source.file === "string",
  );

  // ---- Play, pause, seek ----------------------------------------------------------------
  await place(window, "Songs").click();
  await window.getByRole("row", { name: new RegExp(TITLE) }).dblclick();
  let lcd = window.getByRole("group", { name: "Now Playing" }).first();
  await lcd.getByText(TITLE).waitFor({ timeout: 15_000 });
  await window.getByRole("button", { name: "Pause" }).waitFor({ timeout: 15_000 });
  await reached(page, lcd, 1.5);
  const heard = await pauseAndSave(page, window);
  step("the uploaded song plays: its position moves on", heard > 0.8, `${heard} s`);

  const knob = lcd.getByRole("slider", { name: "Playback position" });
  await knob.focus();
  await knob.press("Home");
  const seeked = nextSave(page, PLAYBACK, (body) => body?.playback?.position === 3);
  for (let n = 0; n < 3; n += 1) await knob.press("ArrowRight");
  await seeked;
  const sought = await storedPosition(page);
  step("seeking to 0:03 is kept", sought === 3, `${sought} s`);
  await window.getByRole("button", { name: "Play", exact: true }).click();
  await reached(page, lcd, 4.5);
  const after = await pauseAndSave(page, window);
  step("playback goes on from the place sought", after >= 3.5 && after < 9, `${after} s`);

  // ---- After a reload the song resumes from its place -----------------------------------
  await settled(page);
  await reloadDesktop(page);
  window = await openMusic(page);
  lcd = window.getByRole("group", { name: "Now Playing" }).first();
  await lcd.getByText(TITLE).waitFor({ timeout: 15_000 });
  const shown = await shownPosition(lcd);
  step(
    "after a reload, the song shows the place it was paused at",
    Math.abs(shown - after) <= 1,
    `${shown} s, paused at ${after} s`,
  );
  const lowest = await playOnFrom(page, window, lcd, Math.floor(after), 1);
  const resumed = await pauseAndSave(page, window);
  step(
    "and Play goes on from there, not from 0:00",
    lowest >= Math.floor(after) - 1 && resumed > after,
    `lowest ${lowest} s, then ${resumed} s`,
  );
  await place(window, "Songs").click();

  // ---- Love it and put it in a new playlist ---------------------------------------------
  const loved = nextSave(page, LIBRARY, (body) => body?.library?.loved?.includes(song.id));
  await window.getByRole("button", { name: `Love ${TITLE}` }).click();
  step("loving the song is saved", (await loved).status() === 200);

  const listed = nextSave(page, LIBRARY, (body) =>
    body?.library?.playlists?.some((p) => p.songs.includes(song.id)),
  );
  await window.getByRole("row", { name: new RegExp(TITLE) }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Playlist" }).hover();
  await page.getByRole("menuitem", { name: "New Playlist" }).click();
  const playlistBody = JSON.parse((await listed).request().postData() ?? "null");
  const playlist = playlistBody.library.playlists.find((p) => p.songs.includes(song.id));
  step("a new playlist holding the song is saved", playlist?.name === "Untitled Playlist");
  step(
    "the playlist is shown with the song in it",
    await window
      .getByRole("grid", { name: "Untitled Playlist" })
      .getByRole("row", { name: new RegExp(TITLE) })
      .isVisible(),
  );
  const mediumRow = await rowHeight(window.getByRole("grid", { name: "Untitled Playlist" }));

  // ---- Preferences: the settings that work are kept, the others dimmed with the reason ----
  await openPreferences(page);
  await page.getByRole("tab", { name: "Playback" }).click();
  step(
    "Crossfade can be used, and nothing says it cannot",
    !(await dimmed(page.getByRole("checkbox", { name: "Crossfade songs" }))) &&
      !(await page.getByText(/no crossfade, enhancement or level matching/).isVisible()),
  );
  await page.getByRole("tab", { name: "General" }).click();
  await page.getByRole("combobox").filter({ hasText: "Medium" }).first().click();
  await page.getByRole("option", { name: "Large" }).click();
  await page.getByRole("checkbox", { name: "When song changes" }).click();
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("checkbox", { name: "Keep on top of all other windows" }).click();
  const preferred = nextSave(page, PREFERENCES, (body) => body?.preferences?.listSize === "large");
  // Every pane has its own Cancel and OK, and the pane left keeps its own for a moment: the
  // selected pane's.
  await page
    .getByRole("tabpanel", { name: "Advanced" })
    .getByRole("button", { name: "OK", exact: true })
    .click();
  const sentPreferences = JSON.parse((await preferred).request().postData() ?? "null");
  const keptPreferences = (await api(page, "GET", PREFERENCES)).json.preferences;
  const inOrder = (kept) => JSON.stringify(Object.entries(kept ?? {}).sort());
  const workingPreferences = inOrder({
    crossfade: false,
    crossfadeSeconds: 6,
    listSize: "large",
    miniPlayerOnTop: true,
    notifications: false,
    songCheckboxes: false,
    soundCheck: false,
    soundEnhancer: false,
    soundEnhancerLevel: 50,
    starRatings: true,
  });
  step(
    "the Preferences that work are saved on the server, and only those",
    inOrder(keptPreferences) === workingPreferences &&
      inOrder(sentPreferences?.preferences) === workingPreferences,
    JSON.stringify(keptPreferences),
  );

  // ---- The Internet Archive ------------------------------------------------------------
  await place(window, "Browse").click();
  const search = window
    .getByRole("region", { name: "Internet Archive search" })
    .getByRole("searchbox", { name: "Search the Internet Archive" })
    .or(
      window
        .getByRole("region", { name: "Internet Archive search" })
        .getByRole("textbox", { name: "Search the Internet Archive" }),
    );
  await window.locator(".mac-card-grid-card").first().waitFor({ timeout: 30_000 });
  step("the Internet Archive's openly licensed music is listed", true);
  await search.first().fill(archiveQuery);
  await search.first().press("Enter");
  // The grid of the search, titled Results, replaces the most played.
  await window.getByText("Results", { exact: true }).first().waitFor({ timeout: 30_000 });
  const card = window.locator(".mac-card-grid-card").first();
  await card.waitFor({ timeout: 30_000 });
  const itemTitle = (await card.locator(".mac-card-grid-card-title").textContent())?.trim() ?? "";
  step("a search finds openly licensed releases", itemTitle.length > 0, itemTitle);
  await card.click();
  const tracks = window.getByRole("grid", { name: /^Tracks of / });
  await tracks.waitFor({ timeout: 30_000 });
  const license = (await window.locator(".mac-music-album-meta a").first().textContent()) ?? "";
  step(
    "the item shows its open licence",
    /^(CC|Public Domain)/.test(license.trim()),
    license.trim(),
  );

  // archive.org's first answer under 400 for the track's sound, watched while the track is
  // played (and played again if archive.org itself fails, `withArchiveRetries`), checked after.
  const fromArchive = page
    .waitForResponse((response) => ARCHIVE_SOUND.test(response.url()) && response.status() < 400, {
      timeout: 150_000,
    })
    .catch(() => null);
  const firstTrack = tracks.getByRole("row").first();
  const trackTitle = ((await firstTrack.textContent()) ?? "")
    .replace(/^\d+/, "")
    .replace(/\d+:\d\d.*$/, "")
    .trim();
  await firstTrack.dblclick();
  await withArchiveRetries(window, () => reached(page, lcd, 2));
  const response = await fromArchive;
  step(
    "the track streams from archive.org",
    response !== null && response.status() < 400,
    response
      ? `${response.status()} ${new globalThis.URL(response.url()).host}`
      : "no answer under 400 from archive.org",
  );
  const archived = await pauseAndSave(page, window);
  step("the Internet Archive track plays: its position moves on", archived > 1, `${archived} s`);

  const keptArchive = nextSave(page, LIBRARY, (body) =>
    body?.library?.songs?.some((s) => s.source?.kind === "archive"),
  );
  await window.getByRole("button", { name: "Add to Library" }).click();
  const archiveBody = JSON.parse((await keptArchive).request().postData() ?? "null");
  const archiveSongs = archiveBody.library.songs.filter((s) => s.source?.kind === "archive");
  step(
    "the item's tracks are added to the library with their licence",
    archiveSongs.length > 0 &&
      archiveSongs.every((s) => /creativecommons\.org\//.test(s.source.license)),
    `${archiveSongs.length} tracks, first ${trackTitle.slice(0, 40)}`,
  );

  // ---- Everything is still there after a reload -----------------------------------------
  await settled(page);
  await reloadDesktop(page);
  window = await openMusic(page);
  await place(window, "Untitled Playlist").click();
  step(
    "after a reload, the playlist still holds the uploaded song",
    await window.getByRole("row", { name: new RegExp(TITLE) }).isVisible(),
  );
  const largeRow = await rowHeight(window.getByRole("grid", { name: "Untitled Playlist" }));
  step(
    "after a reload, the lists are drawn at the List Size kept",
    largeRow > mediumRow,
    `${mediumRow} px, then ${largeRow} px`,
  );
  await openPreferences(page);
  const notifyBox = page.getByRole("checkbox", { name: "When song changes" });
  const shownNotify = await notifyBox.getAttribute("aria-checked");
  const shownSize = await page.getByRole("combobox").filter({ hasText: "Large" }).count();
  await page.getByRole("tab", { name: "Advanced" }).click();
  const shownTop = await page
    .getByRole("checkbox", { name: "Keep on top of all other windows" })
    .getAttribute("aria-checked");
  step(
    "after a reload, the Preferences window shows the settings kept",
    shownNotify === "false" && shownSize > 0 && shownTop === "true",
    `notify ${shownNotify}, large ${shownSize}, on top ${shownTop}`,
  );
  await page
    .getByRole("tabpanel", { name: "Advanced" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page.getByRole("tablist", { name: "Music preferences" }).waitFor({ state: "detached" });
  // The MiniPlayer kept on top stays above a window brought in front of Music.
  await window.getByRole("button", { name: "MiniPlayer" }).click();
  const mini = page.getByRole("region", { name: "MiniPlayer", exact: true });
  await mini.waitFor({ timeout: 10_000 });
  await launch(page, "Calculator");
  const calculator = page.getByRole("region", { name: "Calculator", exact: true }).first();
  await calculator.waitFor({ timeout: 10_000 });
  // The two windows' stacking order where they meet: the z-index of each one's ancestor (or
  // itself) under their nearest common parent, which is what decides which is drawn above.
  const stacking = await page.evaluate(
    ([a, b]) => {
      const chain = (element) => {
        const out = [];
        for (let at = element; at; at = at.parentElement) out.push(at);
        return out;
      };
      const up = chain(a);
      const other = chain(b);
      const common = up.find((element) => other.includes(element));
      const below = (list) => list[list.indexOf(common) - 1];
      const z = (element) => Number(getComputedStyle(element).zIndex) || 0;
      return { mini: z(below(up)), calculator: z(below(other)) };
    },
    [await mini.elementHandle(), await calculator.elementHandle()],
  );
  step(
    "the MiniPlayer kept on top stays above a window brought in front",
    stacking.mini > stacking.calculator && stacking.calculator >= 0,
    JSON.stringify(stacking),
  );
  // Closed again: kept on top, it would cover what the steps after it press in Music.
  await mini.getByRole("button", { name: "Close", exact: true }).click();
  await mini.waitFor({ state: "detached", timeout: 10_000 });
  await page.keyboard.press("Escape");
  await window.click({ position: { x: 600, y: 12 } });
  await place(window, "Loved Songs").click();
  step(
    "after a reload, Loved Songs holds it",
    await window.getByRole("row", { name: new RegExp(TITLE) }).isVisible(),
  );
  await place(window, "Recently Played").click();
  const recent = window.getByRole("grid", { name: "Recently Played" });
  step(
    "after a reload, Recently Played lists both songs played",
    (await recent.getByRole("row", { name: new RegExp(TITLE) }).isVisible()) &&
      (await recent.getByText(trackTitle, { exact: true }).first().isVisible()),
    trackTitle,
  );
  await place(window, "Albums").click();
  step(
    "after a reload, the library shows the uploaded album and the Archive's",
    (await window.locator(".mac-card-grid-card-title").count()) >= 2,
  );
  const stored = await api(page, "GET", PLAYBACK);
  const loaded = stored.json.playback?.queue?.[stored.json.playback?.index];
  const played = archiveSongs.find((s) => s.title === trackTitle) ?? archiveSongs[0];
  step(
    "Up Next is kept: the Archive track is the one loaded",
    loaded !== undefined && loaded === played?.id,
    `${loaded}`,
  );

  // ---- When a song cannot play -------------------------------------------------------------
  // A damaged file chosen in Add Songs… is refused before anything is uploaded. A song whose
  // stored file the browser cannot decode, an Internet Archive track that cannot be reached and
  // one that never arrives each say why and leave nothing playing or loading (read from the
  // media element, not the window), and Play loads the track again once it can be reached.
  const status = window.locator(".mac-music-desktop-status");
  const dismiss = async () => {
    const ok = status.getByRole("button", { name: "OK", exact: true });
    if (await ok.isVisible().catch(() => false)) await ok.click();
  };
  await dismiss();
  const damagedPath = path.join(out, "damaged.wav");
  writeFileSync(damagedPath, randomBytes(64 * 1024));
  const piecesBefore = pieces.length;
  await window
    .locator('input[type="file"][aria-label="Add to Library"]')
    .setInputFiles(damagedPath);
  const refusal = window.getByRole("alert").filter({ hasText: "damaged.wav" });
  await refusal.waitFor({ timeout: 30_000 });
  const refusalText = ((await refusal.textContent()) ?? "").trim();
  const afterRefusal = (await api(page, "GET", LIBRARY)).json.library;
  step(
    "a damaged file chosen to add is refused, saying why, and nothing of it is uploaded or listed",
    /could not be added/.test(refusalText) &&
      pieces.length === piecesBefore &&
      !afterRefusal.songs.some((entry) => entry.source?.name === "damaged.wav"),
    refusalText,
  );
  await dismiss();

  const brokenEntry = await uploadFile(page, {
    parent: "music",
    name: "broken-take.wav",
    type: "audio/wav",
    text: "this is not a sound ",
    size: 48_000,
  });
  made.broken = typeof brokenEntry === "string" ? brokenEntry : brokenEntry?.id;
  const current = (await api(page, "GET", LIBRARY)).json;
  const brokenSong = {
    id: "up-broken-take",
    title: "Broken Take",
    artist: ARTIST,
    album: ALBUM,
    genre: "",
    year: null,
    track: 2,
    duration: 3,
    added: Date.now(),
    artwork: null,
    source: {
      kind: "file",
      file: made.broken,
      name: "broken-take.wav",
      type: "audio/wav",
      size: 48_000,
    },
  };
  const keptBroken = await api(page, "PUT", LIBRARY, {
    library: { ...current.library, songs: [...current.library.songs, brokenSong] },
    rev: current.rev,
  });
  if (keptBroken.status !== 200)
    throw new Error(`the broken song was not kept: HTTP ${keptBroken.status}`);
  await settled(page);
  await reloadDesktop(page);
  window = await openMusic(page);
  await place(window, "Songs").click();
  await window
    .getByRole("row", { name: /Broken Take/ })
    .first()
    .dblclick();
  await window
    .getByRole("alert")
    .filter({ hasText: /be decoded/ })
    .waitFor({ timeout: 30_000 });
  const brokenMedia = await mediaNow(page);
  step(
    "a song whose file cannot be decoded says so; its media element is not playing, nothing loads",
    brokenMedia.played && brokenMedia.paused && (await quiet(window)),
    JSON.stringify(brokenMedia),
  );
  await dismiss();

  const context = page.context();
  const [, second, third] = archiveSongs;
  const cut = (route) => route.abort("internetdisconnected");
  await context.route(ARCHIVE_SOUND, cut);
  await window
    .getByRole("row", { name: new RegExp(escapeRegExp(second.title)) })
    .first()
    .dblclick();
  await window
    .getByRole("alert")
    .filter({ hasText: /can’t be reached/ })
    .waitFor({ timeout: 30_000 });
  const cutMedia = await mediaNow(page);
  step(
    "an Internet Archive track that cannot be reached says so; nothing is left playing or loading",
    cutMedia.paused && (await quiet(window)),
    `${second.title}: ${JSON.stringify(cutMedia)}`,
  );
  await context.unroute(ARCHIVE_SOUND, cut);
  await dismiss();
  await transportPlay(window).click();
  const retried = await withArchiveRetries(window, () => mediaPast(page, 1));
  step(
    "once the Archive can be reached, Play loads the track again and its media element plays",
    !retried.paused && retried.at > 1,
    `${retried.at.toFixed(2)} s of ${retried.duration.toFixed(1)} s`,
  );
  await window.getByRole("button", { name: "Pause" }).click();
  await dismiss();

  const held = [];
  const hold = (route) => {
    held.push(route);
  };
  await context.route(ARCHIVE_SOUND, hold);
  const holdStarted = Date.now();
  await window
    .getByRole("row", { name: new RegExp(escapeRegExp(third.title)) })
    .first()
    .dblclick();
  await window
    .getByRole("alert")
    .filter({ hasText: /stopped answering/ })
    .waitFor({ timeout: 45_000 });
  const heldFor = (Date.now() - holdStarted) / 1000;
  const heldMedia = await mediaNow(page);
  step(
    "an Internet Archive track that never arrives is stopped and says so; nothing is left loading",
    held.length > 0 && heldMedia.paused && (await quiet(window)),
    `${third.title}: after ${heldFor.toFixed(1)} s, ${held.length} request(s) held`,
  );
  await context.unroute(ARCHIVE_SOUND, hold);
  for (const route of held) await route.abort("aborted").catch(() => {});
  await dismiss();

  // ---- Forgotten elsewhere -----------------------------------------------------------------
  // A second tab of this browser plays the uploaded song. This page closes its own Music window
  // (so the other tab is the one Music window open) and forgets the playback, as Storage
  // Management or another browser would. The other tab's next change meets the forgotten
  // document: it takes the forget up and goes on saving, its song still playing. Then this page
  // forgets the library, and the other tab shows it without a reload. In the other tab, a save
  // refused because the document changed (409, which Chromium logs as a failed resource) is part
  // of the recovery; nothing else may be logged.
  await window.getByRole("button", { name: "Close", exact: true }).click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
  await settled(page);
  const other = await page.context().newPage();
  const otherProblems = [];
  other.on("console", (message) => {
    if (message.type() !== "error") return;
    const where = message.location()?.url ?? "";
    if (/status of 409/.test(message.text()) && where.includes("/api/music/")) return;
    if (/did not keep a change to \/api\/music\/library/.test(message.text())) return;
    otherProblems.push(message.text());
  });
  other.on("pageerror", (error) => otherProblems.push(`page error: ${error.message}`));
  const refusedLibrary = [];
  other.on("response", (response) => {
    if (
      response.request().method() === "PUT" &&
      new globalThis.URL(response.url()).pathname === LIBRARY &&
      response.status() >= 400
    )
      refusedLibrary.push(response.status());
  });
  await other.addInitScript(recordMedia);
  await other.goto(`${base}/`, { waitUntil: "load" });
  await other
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 15_000 });
  const elsewhere = await openMusic(other);
  await place(elsewhere, "Songs").click();
  await elsewhere.getByRole("row", { name: new RegExp(TITLE) }).dblclick();
  const before = await mediaPast(other, 1.5);
  step(
    "another tab plays the uploaded song: its media element advances, length decoded",
    !before.paused && Math.abs(before.duration - 10) < 0.5,
    `${before.at.toFixed(2)} s of ${before.duration.toFixed(2)} s`,
  );

  await api(page, "DELETE", PLAYBACK);
  // The other tab hears of the change on the person's stream and reads the playback again, or
  // meets the forget on its next save: either way its next change is a change of the forgotten
  // document.
  await other.waitForTimeout(1_500);
  let pendingSave = storedSave(other, PLAYBACK);
  await elsewhere.getByRole("button", { name: "Pause" }).click();
  await pendingSave;
  const recovered = (await api(page, "GET", PLAYBACK)).json.playback;
  step(
    "after the playback is forgotten elsewhere, the other tab saves again: its song, no history",
    recovered?.queue?.length === 1 &&
      recovered.queue[0] === song.id &&
      recovered.recent.length === 0 &&
      Object.keys(recovered.plays).length === 0 &&
      recovered.position > 1,
    JSON.stringify({
      queue: recovered?.queue,
      recent: recovered?.recent,
      position: recovered?.position,
    }),
  );
  step(
    "the other tab says its playback was forgotten",
    await elsewhere
      .getByRole("alert")
      .filter({ hasText: /playback was forgotten/ })
      .isVisible(),
  );
  await elsewhere.getByRole("button", { name: "Play", exact: true }).click();
  const resumedHere = await mediaPast(other, recovered.position + 1);
  pendingSave = savedAtLeast(other, recovered.position + 0.6);
  await elsewhere.getByRole("button", { name: "Pause" }).click();
  await pendingSave;
  const later = (await api(page, "GET", PLAYBACK)).json.playback;
  step(
    "and it keeps saving: the media element played on and the server holds the new place",
    resumedHere.at > recovered.position && later.position > recovered.position + 0.5,
    `${recovered.position} s, then ${later.position} s`,
  );

  await api(page, "DELETE", LIBRARY);
  await place(elsewhere, "Albums").click();
  await elsewhere.getByText("Your library is empty.").waitFor({ timeout: 15_000 });
  step("after the library is forgotten elsewhere, the other tab shows it without a reload", true);
  step(
    "the other tab sent no library the server refused, and logged nothing else",
    refusedLibrary.length === 0 && otherProblems.length === 0,
    [...refusedLibrary, ...otherProblems].join("; "),
  );
  await other.close();
  await shot(page, path.join(out, `music-${browserName}.png`));
}

await run(async (page) => {
  const made = {};
  try {
    await steps(page, made);
  } finally {
    await cleanUp(page, made);
  }
});

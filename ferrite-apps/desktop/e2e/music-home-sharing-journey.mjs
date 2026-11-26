#!/usr/bin/env node
// Music, File > Home Sharing, between two accounts in two browsers against `ferrite dev`: music.md row 23.
// Chris turns it on through the sheet, Martin finds Chris in the sidebar, lists the songs and plays a drive song, and Chris
// turns it off with Martin listening. Nothing is a stand-in here but the song: a generated tone, in a real drive file.
//
//   node e2e/music-home-sharing-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey } from "./journey-kit.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { createAccount, person } from "./r2-census-kit.mjs";

const run = Date.now().toString(36);
const chris = person(run, "chris", "Chris Marsh");
const martin = person(run, "martin", "Martin Holt");
const SHARING = "/api/music/sharing";
const library = `${SHARING}/libraries/${chris.name}`;
const song = `${library}/songs/kelp`;

const windowOf = (page) => page.locator('.mac-managed-window[data-window-id="music"]').first();
/** The status a read from the page gets; its body is sound or JSON. */
const statusOf = (page, url) => page.evaluate((to) => fetch(to).then((reply) => reply.status), url);
const openMusic = async (page) => {
  await page
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Music", exact: true })
    .click();
  await windowOf(page).waitFor({ timeout: 20_000 });
};

/** A drive file holding a 20-second tone, through the drive's own upload routes. */
const uploadTone = (page) =>
  page.evaluate(async () => {
    const rate = 8000;
    const frames = rate * 20;
    const bytes = new DataView(new ArrayBuffer(44 + frames));
    const text = (at, words) => {
      for (const [i, c] of [...words].entries()) bytes.setUint8(at + i, c.charCodeAt(0));
    };
    text(0, "RIFF");
    bytes.setUint32(4, 36 + frames, true);
    text(8, "WAVEfmt ");
    bytes.setUint32(16, 16, true);
    bytes.setUint16(20, 1, true);
    bytes.setUint16(22, 1, true);
    bytes.setUint32(24, rate, true);
    bytes.setUint32(28, rate, true);
    bytes.setUint16(32, 1, true);
    bytes.setUint16(34, 8, true);
    text(36, "data");
    bytes.setUint32(40, frames, true);
    for (let i = 0; i < frames; i += 1) {
      bytes.setUint8(44 + i, 128 + Math.round(60 * Math.sin((i / rate) * 2 * Math.PI * 440)));
    }
    const json = { "content-type": "application/json" };
    const start = await fetch("/api/files/uploads", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        parent: "music",
        name: "kelp.wav",
        size: bytes.byteLength,
        type: "audio/wav",
      }),
    }).then((reply) => reply.json());
    await fetch(`/api/files/uploads/${start.upload}/0`, { method: "PUT", body: bytes.buffer });
    const done = await fetch(`/api/files/uploads/${start.upload}/complete`, {
      method: "POST",
      headers: json,
      body: "{}",
    }).then((reply) => reply.json());
    return { file: done.created[0], size: bytes.byteLength };
  });

await journey("music-home-sharing", async ({ page, base, out, step }) => {
  const shot = (from, name) =>
    from.screenshot({ path: path.join(out, `home-sharing-${name}.png`) });
  step("Chris's account is made", await createAccount(page, base, chris));
  const { file, size } = await uploadTone(page);
  const saved = await api(page, "PUT", "/api/music/library", {
    library: {
      songs: [
        {
          id: "kelp",
          title: "Kelp",
          artist: "Tide",
          album: "Shore",
          genre: "Ambient",
          year: 2001,
          track: 1,
          duration: 20,
          added: 1,
          artwork: null,
          rating: 5,
          source: { kind: "file", file, name: "kelp.wav", type: "audio/wav", size },
        },
      ],
      playlists: [
        { id: "open", name: "Open Mix", songs: ["kelp"] },
        { id: "mine", name: "Private Mix", songs: ["kelp"], private: true },
        { id: "later", name: "Later Mix", songs: ["kelp"] },
      ],
      loved: [],
    },
    rev: 0,
  });
  step(
    "Chris's library holds a drive song and three playlists",
    saved.status === 200,
    String(saved.status),
  );
  await openMusic(page);
  await windowOf(page).getByText("Later Mix", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide from Home Sharing" }).click();
  step(
    "Hide from Home Sharing marks the playlist private on the server",
    await until(async () => {
      const held = await api(page, "GET", "/api/music/library");
      return held.json.library.playlists.find((list) => list.id === "later")?.private === true;
    }),
  );

  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  const other = await context.newPage();
  await other.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    window.mediaPlayed = [];
    HTMLMediaElement.prototype.play = function (...args) {
      window.mediaPlayed.push(this);
      return play.apply(this, args);
    };
  });
  const heard = () =>
    other.evaluate(() =>
      Math.max(0, ...window.mediaPlayed.map((media) => (media.paused ? 0 : media.currentTime))),
    );
  const songReads = [];
  other.on("response", (reply) => {
    if (new URL(reply.url()).pathname === song) songReads.push(reply.status());
  });
  const unexpected = [];
  other.on("pageerror", (error) => unexpected.push(error.message));
  other.on("response", (reply) => {
    if (reply.status() >= 400 && reply.status() !== 403)
      unexpected.push(`${reply.status()} ${reply.url()}`);
  });
  step("Martin's account is made in another browser", await createAccount(other, base, martin));
  await openMusic(other);
  const listener = windowOf(other);
  await other.waitForTimeout(1_500);
  step(
    "off by default: Martin's sidebar names nobody",
    (await listener.getByText(chris.fullName, { exact: true }).count()) === 0,
  );
  step(
    "off by default: the server refuses the library and the song",
    (await statusOf(other, library)) === 403 && (await statusOf(other, song)) === 403,
  );

  await chooseMenu(page, "File", "Home Sharing", "Turn On Home Sharing…");
  const sheet = page.getByRole("dialog", { name: "Home Sharing" });
  await sheet.waitFor({ timeout: 10_000 });
  step(
    "the sheet says plainly that any account here can hear the library",
    /Any account on this desktop can then see your library in Music and hear its songs/.test(
      await sheet.innerText(),
    ),
  );
  await page.waitForTimeout(800);
  await shot(page, "sheet");
  await sheet.getByRole("button", { name: "Turn On Home Sharing" }).click();
  step(
    "turned on, the switch is on the server",
    await until(async () => (await api(page, "GET", SHARING)).json.on === true),
  );

  const row = listener.getByText(chris.fullName, { exact: true }).first();
  step(
    "Chris's name comes to Martin's sidebar, by its own check",
    await until(() => row.isVisible(), 35_000),
  );
  await row.click();
  const kelp = listener.getByText("Kelp", { exact: true }).first();
  step("Martin lists Chris's songs", await until(() => kelp.isVisible(), 10_000));
  step(
    "an open playlist shows, and the private one does not",
    (await listener.getByText("Open Mix", { exact: true }).count()) === 1 &&
      (await listener.getByText("Private Mix", { exact: true }).count()) === 0 &&
      (await listener.getByText("Later Mix", { exact: true }).count()) === 0,
  );
  const lent = await api(other, "GET", library);
  step(
    "the listing holds no rating, file id or file name",
    !JSON.stringify(lent.json).includes(file) &&
      !/rating|kelp\.wav/.test(JSON.stringify(lent.json)),
  );
  await shot(other, "listener");

  await kelp.dblclick();
  const pause = listener.getByRole("button", { name: "Pause", exact: true });
  step("double click plays it", await until(() => pause.isVisible(), 15_000));
  step(
    "its bytes came by the route that names the song",
    await until(async () => songReads.includes(200), 5_000),
    songReads.join(),
  );
  const moving = await until(async () => (await heard()) > 0.2, 10_000);
  const first = await heard();
  await other.waitForTimeout(1_000);
  const later = await heard();
  step("the media element's place moves on", moving && later > first, `${first} then ${later}`);
  const lcd = listener
    .getByRole("toolbar", { name: "Playback controls" })
    .or(listener.getByLabel("Playback controls"));
  step(
    "Now Playing names the song",
    await until(async () => /Kelp/.test(await lcd.first().innerText()), 10_000),
  );
  const sound = await other.evaluate(() => navigator.mediaSession?.metadata?.title ?? "");
  step("Media Session names the song", sound === "Kelp", sound);
  await shot(other, "playing");
  await other.waitForTimeout(3_000);
  const kept = await api(other, "GET", "/api/music/playback");
  step(
    "Martin's playback on the server names nothing of Chris's",
    !JSON.stringify(kept.json).includes("kelp"),
    JSON.stringify(kept.json.playback?.queue ?? null),
  );

  await chooseMenu(page, "File", "Home Sharing", "Turn Off Home Sharing");
  step(
    "turned off, the server refuses Martin's next read of the song at once",
    await until(async () => (await statusOf(other, song)) === 403, 3_000),
  );
  const atOff = Date.now();
  step(
    "Martin's window stops the song and leaves the library",
    await until(
      async () =>
        (await pause.count()) === 0 &&
        (await listener.getByText("Kelp", { exact: true }).count()) === 0,
      8_000,
    ),
    `${Date.now() - atOff} ms`,
  );
  step("and no media element plays on", (await heard()) === 0);
  step(
    "Chris's name leaves Martin's sidebar",
    (await listener.getByText(chris.fullName, { exact: true }).count()) === 0,
  );
  step(
    "and Martin is told",
    /no longer sharing/.test(await listener.getByRole("alert").first().innerText()),
  );
  await shot(other, "ended");
  step(
    "nothing else went wrong in Martin's browser",
    unexpected.length === 0,
    unexpected.join("; "),
  );
  await context.close();
});

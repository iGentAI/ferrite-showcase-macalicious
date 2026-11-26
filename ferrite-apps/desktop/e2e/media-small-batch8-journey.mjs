#!/usr/bin/env node
// Small rows of several apps, all on the served desktop as one signed-in person, with a second for
// Chess: Music reads pictures out of a song's own file (ID3 APIC, FLAC PICTURE, MP4 covr) and keeps
// them; deleting a song puts back a file another window names again; the App Store's Update All runs
// on the versions of the served build; TV's Preferences act; Chess's Losers and Suicide are refused
// and read back from the server; Font Book's Catalog and Repertoire reach the print frame; Photo Booth's
// File > Export hands over the stored file.
//
// Stand-ins, each said in its step: a canvas stream for Photo Booth's camera; the frame's print() for
// the browser's print dialog; a `kept` version written through the server's own route for the state an
// earlier build would have left, since only a new deploy moves the current version; a PUT through the
// library's route for a second window that names a file again.
//
//   node e2e/media-small-batch8-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { readFileSync } from "node:fs";
import path from "node:path";
import { api, reloadDesktop } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";
import { options, twoPeople, within } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { out, base } = options();
const { step, allow, run, shot } = twoPeople("media-small-batch8");
// Pictures of other sites (TV's thumbnails) are not this app's to serve.
allow(/(request failed|HTTP \d+): https?:\/\/(?!127\.0\.0\.1)/);
allow(/console: Failed to load resource: net::ERR/);
// The server's refusal of a move Chess's rules forbid, which a step provokes.
allow(/HTTP 4\d\d: \S*\/api\/chess\/games\/\S*\/plies/);
allow(/console: Failed to load resource: the server responded with a status of 4/);
// Playwright's init script in the sandboxed print frames, not a script of the page.
allow(/console: Blocked script execution in 'about:srcdoc'/);

const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `bchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `bmartin-${id}`, fullName: `Martin ${id}`, password };

const MUSIC = "/api/music/library";
const APPS = "/api/app-store/library";
const VERSIONS = "/api/app-store/versions";
const TV_PREFS = "/api/tv/preferences";
const TV_LIBRARY = "/api/tv/library";
const SOLD = ["chess", "photo-booth", "font-book", "books", "stocks", "tv", "music"];

const region = (page, name) => page.getByRole("region", { name, exact: true }).first();

async function open(page, name) {
  await page
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${name}$`) }))
    .first()
    .click();
  const window = region(page, name);
  await window.waitFor({ state: "visible", timeout: 20_000 });
  return window;
}

// ---- Song files, built byte by byte, with a picture where each format keeps one ------------------

const u32be = (n) => {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(n, 0);
  return out;
};
const synchsafe = (n) =>
  Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);

/** Silent MPEG-1 layer III frames at 128 kbit/s, about five seconds. */
const mp3Frames = () => {
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  return Buffer.concat(Array.from({ length: 200 }, () => frame));
};

function mp3(title, album, picture) {
  const textFrame = (name, text) => {
    const body = Buffer.concat([Buffer.from([0]), Buffer.from(text, "latin1")]);
    return Buffer.concat([Buffer.from(name), u32be(body.length), Buffer.alloc(2), body]);
  };
  const frames = [textFrame("TIT2", title), textFrame("TALB", album)];
  if (picture) {
    const body = Buffer.concat([
      Buffer.from([0]),
      Buffer.from("image/png\0", "latin1"),
      Buffer.from([3, 0]),
      picture,
    ]);
    frames.push(Buffer.concat([Buffer.from("APIC"), u32be(body.length), Buffer.alloc(2), body]));
  }
  const tag = Buffer.concat(frames);
  return Buffer.concat([
    Buffer.from("ID3"),
    Buffer.from([3, 0, 0]),
    synchsafe(tag.length),
    tag,
    mp3Frames(),
  ]);
}

const crc = (bytes, poly, width) => {
  const top = 1 << (width - 1);
  const mask = (1 << width) - 1;
  let value = 0;
  for (const byte of bytes) {
    value ^= byte << (width - 8);
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & top ? ((value << 1) ^ poly) & mask : (value << 1) & mask;
    }
  }
  return value;
};

/** A mono FLAC of silent constant-value frames with a PICTURE block. */
function flac(picture) {
  const count = 40;
  const info = Buffer.alloc(34);
  info.writeUInt16BE(4096, 0);
  info.writeUInt16BE(4096, 2);
  // 44100 Hz (20 bits), mono (3), 16 bits a sample (5), then the 36 bits of the samples' count.
  const packed = (44100n << 44n) | (0n << 41n) | (15n << 36n) | BigInt(4096 * count);
  info.writeBigUInt64BE(packed, 10);
  const block = (type, last, body) => {
    const head = Buffer.alloc(4);
    head[0] = (last ? 0x80 : 0) | type;
    head.writeUIntBE(body.length, 1, 3);
    return Buffer.concat([head, body]);
  };
  const mime = Buffer.from("image/png");
  const pictureBlock = Buffer.concat([
    u32be(3),
    u32be(mime.length),
    mime,
    u32be(0),
    Buffer.alloc(16),
    u32be(picture.length),
    picture,
  ]);
  const frames = Array.from({ length: count }, (_, number) => {
    const head = Buffer.from([0xff, 0xf8, 0xc9, 0x08, number]);
    const body = Buffer.concat([head, Buffer.from([crc(head, 0x07, 8), 0x00, 0x00, 0x00])]);
    const tail = Buffer.alloc(2);
    tail.writeUInt16BE(crc(body, 0x8005, 16));
    return Buffer.concat([body, tail]);
  });
  return Buffer.concat([
    Buffer.from("fLaC"),
    block(0, false, info),
    block(6, true, pictureBlock),
    ...frames,
  ]);
}

/** The boxes of an M4A that hold its tags, and no sound: enough for the file's own tags to be read. */
function m4aTags(picture) {
  const box = (type, ...body) => {
    const inner = Buffer.concat(body);
    return Buffer.concat([u32be(inner.length + 8), Buffer.from(type, "latin1"), inner]);
  };
  const data = box("data", u32be(14), u32be(0), picture);
  return Buffer.concat([
    box("ftyp", Buffer.from("M4A "), u32be(0)),
    box("moov", box("udta", box("meta", Buffer.alloc(4), box("ilst", box("covr", data))))),
  ]);
}

const pngOf = async (page, colour) =>
  Buffer.from(
    await page.evaluate((fill) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      context.fillStyle = fill;
      context.fillRect(0, 0, 64, 64);
      return canvas.toDataURL("image/png").split(",")[1];
    }, colour),
    "base64",
  );

/** The middle pixel of a cover the server keeps, as `[r, g, b]`. */
const coverPixel = (page, digest) =>
  page.evaluate(async (name) => {
    const reply = await fetch(`/api/music/artwork/${name}`, { credentials: "same-origin" });
    if (!reply.ok) return null;
    const bitmap = await createImageBitmap(await reply.blob());
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    return [...context.getImageData(bitmap.width >> 1, bitmap.height >> 1, 1, 1).data].slice(0, 3);
  }, digest);

const near = (pixel, wanted) =>
  Array.isArray(pixel) && pixel.every((value, at) => Math.abs(value - wanted[at]) < 12);

const musicLibrary = async (page) => (await api(page, "GET", MUSIC)).json;
const songNamed = async (page, title) =>
  (await musicLibrary(page)).library?.songs?.find((song) => song.title === title);

async function musicRows(page) {
  const status = (shown) => shown.locator(".mac-music-desktop-status");
  const orange = await pngOf(page, "#ff8000");
  const blue = await pngOf(page, "#0040ff");
  const green = await pngOf(page, "#00c000");
  let window = await open(page, "Music");
  const input = page.locator('input[type="file"][aria-label="Add to Library"]');
  await input.waitFor({ state: "attached", timeout: 15_000 });
  await input.setInputFiles([
    { name: "cove.mp3", mimeType: "audio/mpeg", buffer: mp3("Cove", "Copper Tide", orange) },
    { name: "Reef.flac", mimeType: "audio/flac", buffer: flac(blue) },
    { name: "plain.mp3", mimeType: "audio/mpeg", buffer: mp3("Plain", "Bare", null) },
  ]);
  await until(async () => (await musicLibrary(page)).library?.songs?.length === 3, 30_000);
  const cove = await songNamed(page, "Cove");
  const reef = await songNamed(page, "Reef");
  const plain = await songNamed(page, "Plain");
  const pixelOf = (song) => (song?.artwork ? coverPixel(page, song.artwork) : null);
  const covePixel = await pixelOf(cove);
  step(
    "an MP3's ID3 APIC picture is kept with the song on the server",
    near(covePixel, [255, 128, 0]),
    `${cove?.artwork?.slice(0, 8)} ${covePixel}`,
  );
  const reefPixel = await pixelOf(reef);
  step(
    "a FLAC's PICTURE block is kept with the song on the server",
    near(reefPixel, [0, 64, 255]),
    `${reef?.artwork?.slice(0, 8)} ${reefPixel}`,
  );
  step("a file with no picture has none", plain?.artwork === null, String(plain?.artwork));

  const coverShown = async () => {
    await window.getByRole("treeitem", { name: "Albums", exact: true }).first().click();
    const image = window.locator(`img[src="/api/music/artwork/${cove.artwork}"]`).first();
    await image.waitFor({ timeout: 10_000 });
    return image.evaluate((each) => each.complete && each.naturalWidth > 0);
  };
  step("the Albums view draws the file's own picture", await coverShown());
  await shot(page, "batch8-music-albums");
  await reloadDesktop(page);
  window = await open(page, "Music");
  step("and so it does across a reload", await coverShown());

  // ---- Get Album Artwork reads songs that have no picture yet ------------------------------------
  const m4aId = await uploadFile(page, {
    parent: "music",
    name: "Harbor.m4a",
    type: "audio/mp4",
    bytes: m4aTags(green),
  });
  const stored = await musicLibrary(page);
  const seeded = await api(page, "PUT", MUSIC, {
    library: {
      ...stored.library,
      songs: [
        ...stored.library.songs,
        {
          ...plain,
          id: "up-harbor",
          title: "Harbor",
          artwork: null,
          source: { kind: "file", file: m4aId, name: "Harbor.m4a", type: "audio/mp4", size: 1 },
        },
      ],
    },
    rev: stored.rev,
  });
  step(
    "a song naming an M4A of the drive is on the server",
    seeded.status < 300,
    `${seeded.status}`,
  );
  await reloadDesktop(page);
  window = await open(page, "Music");
  await window.getByRole("treeitem", { name: "Songs", exact: true }).first().waitFor();
  await until(async () => {
    const state = await menuItemState(page, "File", "Library", "Get Album Artwork");
    return state.disabled === false;
  }, 10_000);
  const elsewhere = [];
  const watchOut = (request) => {
    if (!request.url().startsWith(base) && !/^(data|blob):/.test(request.url())) {
      elsewhere.push(request.url());
    }
  };
  page.on("request", watchOut);
  await chooseMenu(page, "File", "Library", "Get Album Artwork");
  await status(page)
    .getByText(/^Artwork from their own files/)
    .waitFor({ timeout: 20_000 });
  const said = await status(page).innerText();
  step(
    "File > Library > Get Album Artwork says what it found",
    /added to 1 of 2 songs/.test(said),
    said.split("\n")[0],
  );
  await status(page).getByRole("button", { name: "OK" }).click();
  page.off("request", watchOut);
  await until(async () => Boolean((await songNamed(page, "Harbor"))?.artwork), 10_000);
  const harbor = (await songNamed(page, "Harbor"))?.artwork;
  const harborPixel = harbor ? await coverPixel(page, harbor) : null;
  step(
    "an M4A's covr picture is kept with the song on the server",
    near(harborPixel, [0, 192, 0]),
    String(harborPixel),
  );
  step(
    "and the songs' files were read in this page, asking nothing of another site",
    elsewhere.length === 0,
    elsewhere.join(" "),
  );
  await chooseMenu(page, "File", "Library", "Get Album Artwork");
  await status(page)
    .getByText(/^No picture was found/)
    .waitFor({ timeout: 10_000 });
  step(
    "a second run finds nothing more and changes nothing",
    (await songNamed(page, "Harbor"))?.artwork === harbor &&
      (await songNamed(page, "Plain"))?.artwork === null,
  );
  await status(page).getByRole("button", { name: "OK" }).click();

  // ---- Deleting a song ------------------------------------------------------------------------------
  const entryOf = async (fileId) =>
    (await api(page, "GET", "/api/files/")).json.entries.find((each) => each.id === fileId);
  const rowOf = (title) => window.getByRole("row", { name: new RegExp(title) }).first();
  await window.getByRole("treeitem", { name: "Songs", exact: true }).first().click();
  await rowOf("Cove").click();
  await chooseMenu(page, "Song", "Delete from Library");
  await page.getByRole("button", { name: "Move to Trash", exact: true }).click();
  step(
    "Move to Trash puts a song's file in the Trash, and it can be recovered there",
    await until(async () => Boolean((await entryOf(cove.source.file))?.trashed_ms), 15_000),
  );

  // A second window names the file again between Music's read-back and its trash request.
  await page.route(/\/api\/files\/ops/, async (route) => {
    if (!route.request().postData()?.includes('"trash"')) return route.continue();
    const now = await musicLibrary(page);
    await api(page, "PUT", MUSIC, {
      library: { ...now.library, songs: [...now.library.songs, reef] },
      rev: now.rev,
    });
    return route.continue();
  });
  await rowOf("Reef").click();
  await chooseMenu(page, "Song", "Delete from Library");
  await page.getByRole("button", { name: "Move to Trash", exact: true }).click();
  const restored = await until(async () => {
    const entry = await entryOf(reef.source.file);
    const named = await songNamed(page, "Reef");
    return Boolean(named) && entry !== undefined && !entry.trashed_ms;
  }, 20_000);
  await page.unroute(/\/api\/files\/ops/);
  const left = await entryOf(reef.source.file);
  step(
    "a file another window names again as it goes to the Trash comes back out (second window: a PUT through the library's route)",
    restored === true,
    `trashed ${left?.trashed_ms}; song ${Boolean(await songNamed(page, "Reef"))}`,
  );
}

async function appStoreRows(page) {
  let store = await open(page, "App Store");
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
  const updates = async () => {
    await store
      .getByRole("treeitem", { name: /Updates/ })
      .first()
      .click();
  };
  await updates();
  const versions = async () => (await api(page, "GET", VERSIONS)).json;
  const first = await versions();
  step(
    "the served store has a real version: the served build's digest",
    /^[0-9a-f]{12}$/.test(first.current),
    first.current,
  );
  const { json: marker } = await api(page, "GET", "/ferrite-site.json");
  step(
    "which is the start of the build the server names",
    marker.build_id.startsWith(`sha256:${first.current}`),
    marker.build_id.slice(0, 19),
  );
  step(
    "an app got takes the current version by itself",
    await until(async () => (await versions()).kept?.books === first.current, 10_000),
  );
  step(
    "with nothing behind the page says so and offers no Update All",
    (await store.getByRole("button", { name: "Update All" }).count()) === 0 &&
      /up to date/i.test(await store.locator(".mac-app-store-page").innerText()),
  );

  // Automatic Updates off, and two apps left by an earlier build: the state a new deploy finds.
  await chooseMenu(page, "App Store", "Preferences…");
  await page.getByRole("checkbox", { name: "Automatic Updates" }).click();
  await store.getByText("Automatic Updates is off").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(800);
  const leaveBehind = async () => {
    const now = await versions();
    const seeded = await api(page, "PUT", VERSIONS, {
      kept: { ...now.kept, books: "000000000001", stocks: "000000000001" },
      rev: now.rev,
    });
    if (seeded.status >= 300) throw new Error(`seed: ${seeded.status}`);
  };
  await leaveBehind();
  await reloadDesktop(page);
  store = await open(page, "App Store");
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
  await updates();
  const all = store.getByRole("button", { name: "Update All" });
  await all.waitFor({ timeout: 10_000 });
  const page_ = await store.locator(".mac-app-store-page").innerText();
  step(
    "apps behind wait in Pending, with the version they would take (seeded through the server's route)",
    /2 updates wait/.test(page_) && page_.includes(`Version ${first.current}`),
  );
  await shot(page, "batch8-app-store-updates");
  await all.click();
  await store.getByRole("button", { name: "Open, Books" }).first().waitFor({ timeout: 30_000 });
  await store.getByRole("button", { name: "Open, Stocks" }).first().waitFor({ timeout: 30_000 });
  step(
    "Update All runs both, and the server holds the current version of each",
    await until(async () => {
      const { kept } = await versions();
      return kept?.books === first.current && kept?.stocks === first.current;
    }, 15_000),
  );
  await reloadDesktop(page);
  store = await open(page, "App Store");
  await store.locator('.mac-app-store-page:not([aria-busy="true"])').waitFor({ timeout: 15_000 });
  await updates();
  step(
    "across a reload nothing waits",
    (await store.getByRole("button", { name: "Update All" }).count()) === 0,
  );

  // Automatic Updates on: the same state takes the version by itself.
  await chooseMenu(page, "App Store", "Preferences…");
  await page.getByRole("checkbox", { name: "Automatic Updates" }).click();
  await store.getByText("Automatic Updates is on").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(800);
  await leaveBehind();
  await reloadDesktop(page);
  store = await open(page, "App Store");
  step(
    "with Automatic Updates on a new version arrives by itself",
    await until(async () => (await versions()).kept?.books === first.current, 15_000),
  );
  await store.getByRole("button", { name: "Close", exact: true }).first().click();
}

async function tvRows(page) {
  const name = `Float ${id}`;
  const made = await page.evaluate(async (title) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d");
    const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: "video/webm" });
    const pieces = [];
    recorder.ondataavailable = (event) => pieces.push(event.data);
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    recorder.start();
    for (let frame = 0; frame < 60; frame += 1) {
      context.fillStyle = `hsl(${frame * 6}, 80%, 50%)`;
      context.fillRect(0, 0, 320, 180);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(pieces, { type: "video/webm" });
    const json = { "content-type": "application/json" };
    const uploading = await fetch("/api/files/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: JSON.stringify({
        parent: "movies",
        name: `${title}.webm`,
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
    const done = await fetch(`/api/files/uploads/${uploading.upload}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: json,
      body: "{}",
    }).then((reply) => reply.json());
    return done.created[0];
  }, name);
  const before = (await api(page, "GET", TV_LIBRARY)).json;
  await api(page, "PUT", TV_LIBRARY, {
    library: {
      ...(before.library ?? { videos: [], history: [], upNext: [], watchLater: [], positions: {} }),
      homeVideos: [...(before.library?.homeVideos ?? []), { id: made, place: 0 }],
    },
    rev: before.rev,
  });
  await reloadDesktop(page);
  let window = await open(page, "TV");
  await chooseMenu(page, "TV", "Preferences…");
  const general = page.getByRole("dialog", { name: "General" });
  await general.waitFor({ timeout: 8_000 });
  const downloads = await general
    .getByRole("checkbox", { name: "Always check for available downloads" })
    .getAttribute("title");
  step("what TV cannot do stays dimmed, saying why", /no store/.test(downloads ?? ""), downloads);
  await general.getByRole("checkbox", { name: "Checkboxes in library" }).click();
  await page.getByRole("tab", { name: "Playback" }).click();
  const playback = page.getByRole("dialog", { name: "Playback" });
  await playback.getByRole("checkbox", { name: "Use the screen saver while paused" }).click();
  await playback.getByRole("button", { name: "OK" }).click();
  const preferences = async () => (await api(page, "GET", TV_PREFS)).json.preferences;
  step(
    "Checkboxes in library and the screen saver while paused are kept on the server",
    await until(async () => {
      const kept = await preferences();
      return kept?.checkboxes === true && kept?.screenSaver === true;
    }, 8_000),
    JSON.stringify(await preferences()),
  );
  await chooseMenu(page, "View", "Library");
  const box = window.getByRole("checkbox", { name });
  await box.waitFor({ timeout: 10_000 });
  step("a title of the Library has its checkbox, ticked", await box.isChecked());
  await box.click();
  step(
    "clearing it is kept on the server",
    await until(async () => (await preferences())?.unchecked?.includes(made), 8_000),
  );
  await shot(page, "batch8-tv-checkboxes");
  await reloadDesktop(page);
  window = await open(page, "TV");
  await chooseMenu(page, "View", "Library");
  await window.getByRole("checkbox", { name }).waitFor({ timeout: 10_000 });
  step("and across a reload", (await window.getByRole("checkbox", { name }).isChecked()) === false);

  await window.locator(".mac-card-grid-card", { hasText: name }).first().click();
  const video = window.locator(".mac-tv-player-video video");
  await video.waitFor({ timeout: 8_000 });
  await until(() => video.evaluate((element) => element.readyState >= 1), 10_000);
  await page.waitForTimeout(400);
  await video.evaluate((element) => element.pause());
  const saver = page.locator(".mac-system-preferences-screen-saver");
  const waited = await within(80_000, async () => (await saver.count()) === 1);
  step(
    "paused with no input, the desktop's screen saver starts",
    waited !== null && waited > 50_000,
    `after ${waited} ms`,
  );
  await shot(page, "batch8-tv-saver");
  // The hand's rest just after it starts does not end it.
  await page.waitForTimeout(800);
  await page.mouse.move(400, 300);
  await page.mouse.move(420, 320);
  step("input takes it away", await until(async () => (await saver.count()) === 0, 5_000));
  await window.getByRole("button", { name: "Close", exact: true }).first().click();
}

async function chessRows(a, b) {
  const windowOf = (page) => page.locator(".mac-chess").first();
  const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
  const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
  const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
  const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();
  const move = async (page, from, to) => {
    await square(page, from).click();
    await square(page, to).click();
  };
  const choose = async (page, name, option) => {
    await page
      .getByRole("combobox", { name })
      .or(page.getByRole("button", { name }))
      .first()
      .click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  const mine = async (page) => (await api(page, "GET", "/api/chess/mine")).json.games ?? [];
  const game = async (page, gameId) => (await api(page, "GET", `/api/chess/games/${gameId}`)).json;
  const ply = (page, gameId, index, from, to) =>
    api(page, "POST", `/api/chess/games/${gameId}/plies`, { number: 1, ply: index, from, to });
  const LIVE = 20_000;

  const invited = async (variant) => {
    await chooseMenu(a, "Game", "New Game…");
    const sheet = a.getByRole("dialog").filter({ hasText: "New Game" });
    await sheet.waitFor({ timeout: 10_000 });
    await choose(a, "Opponent", "Another person");
    await sheet.getByRole("textbox", { name: "Account name" }).fill(martin.name);
    await choose(a, "Play as", "White");
    await choose(a, "Variant", variant);
    await choose(a, "Clock", "No clock");
    await sheet.getByRole("button", { name: "Send Invitation" }).click();
    await sheet.waitFor({ state: "hidden", timeout: 8_000 });
    const gamesButton = windowOf(b).getByRole("button", { name: /^Games/ });
    await within(LIVE, async () => /\(1\)/.test(await gamesButton.innerText()));
    await gamesButton.click();
    const list = b.getByRole("dialog").filter({ hasText: "Games" });
    await list.waitFor({ timeout: 10_000 });
    await list.getByRole("button", { name: "Accept" }).first().click();
    await list.waitFor({ state: "hidden", timeout: 30_000 });
    await within(LIVE, async () => !(await status(a)).includes("Waiting for"));
    return (await mine(a))[0].id;
  };

  for (const page of [a, b]) {
    await open(page, "Chess").catch(() => {});
    await board(page).waitFor({ state: "visible", timeout: 15_000 });
  }

  for (const [variant, wanted] of [
    ["Losers", "losers"],
    ["Suicide", "suicide"],
  ]) {
    const gameId = await invited(variant);
    const listed = (await mine(a)).find((each) => each.id === gameId);
    step(
      `${variant}: the server holds the game as ${wanted}`,
      listed?.variant === wanted,
      listed?.variant,
    );
    await ply(a, gameId, 0, "e2", "e4");
    await ply(b, gameId, 1, "d7", "d5");
    await within(LIVE, async () => (await label(a, "d5")).includes("black pawn"));
    await move(a, "g1", "f3");
    await a.waitForTimeout(500);
    const held = await game(a, gameId);
    step(
      `${variant}: the board refuses a move while a capture is there to make`,
      (await label(a, "g1")).includes("white knight") && held.state.plies.length === 2,
      `${held.state.plies.length} plies`,
    );
    await square(a, "g1")
      .click()
      .catch(() => {});
    const refused = await ply(a, gameId, 2, "g1", "f3");
    step(
      `${variant}: so does the server, sent the same move`,
      refused.status >= 400 &&
        refused.status < 500 &&
        (await game(a, gameId)).state.plies.length === 2,
      String(refused.status),
    );
    await move(a, "e4", "d5");
    const taken = await until(async () => {
      const plies = (await game(a, gameId)).state.plies;
      return plies.length === 3 && plies[2].from === "e4" && plies[2].to === "d5";
    }, 15_000);
    step(
      `${variant}: the capture is played on the board and read back from the server`,
      taken === true && (await label(a, "d5")).includes("white pawn"),
      await label(a, "d5"),
    );
    await shot(a, `batch8-chess-${wanted}`);
    await chooseMenu(a, "Game", "Resign");
    await within(LIVE, async () => /resign|won|lost|over/i.test(await status(b)));
  }
  await a.reload();
  await b.close().catch(() => {});
  await a
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
}

async function fontBookRows(page) {
  await open(page, "Font Book").catch(() => {});
  const window = page.locator('[data-window-id="font-book"]').first();
  await window.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    new MutationObserver(() => {
      const frame = document.querySelector("iframe[data-textedit-print]");
      if (!frame) return;
      frame.addEventListener(
        "load",
        () => {
          frame.contentWindow.print = () => {
            window.__printedText = frame.contentDocument.body.innerText;
            window.__printedFonts = [
              ...frame.contentDocument.querySelectorAll('div[style*="font-family"]'),
            ].map((each) => each.style.fontFamily);
          };
        },
        { capture: true, once: true },
      );
    }).observe(document.body, { childList: true });
  });
  await window
    .getByText("Courier", { exact: false })
    .first()
    .click()
    .catch(() => {});
  const report = async (name) => {
    await page.evaluate(() => {
      window.__printedText = undefined;
    });
    await chooseMenu(page, "File", "Print…");
    const sheet = page.getByRole("dialog").filter({ hasText: "Print Fonts" });
    await sheet.waitFor({ timeout: 5_000 });
    await sheet.getByRole("combobox", { name: "Report Type" }).click();
    await page.getByRole("option", { name }).click();
    await sheet.getByRole("button", { name: "Print", exact: true }).click();
    await until(() => page.evaluate(() => window.__printedText), 10_000);
    return page.evaluate(() => window.__printedText);
  };
  const catalog = await report("Catalog");
  const catalogFonts = await page.evaluate(() => window.__printedFonts ?? []);
  step(
    "Font Book's Catalog prints a line of each style in its own font (print frame read; the dialog stood in for by the frame's print)",
    /Regular/.test(catalog ?? "") && catalogFonts.length > 0,
    `${catalogFonts.length} set lines; ${(catalog ?? "").slice(0, 60).replace(/\n/g, " / ")}`,
  );
  const repertoire = await report("Repertoire");
  step(
    "Font Book's Repertoire prints the family's characters (same frame, same stand-in)",
    /(\S ){8}/.test(repertoire ?? ""),
    (repertoire ?? "").slice(0, 60).replace(/\n/g, " / "),
  );
  await shot(page, "batch8-font-book-print");
  await window.getByRole("button", { name: "Close", exact: true }).first().click();
}

async function photoBoothRows(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("Photo Booth");
  await field.press("Enter");
  const window = region(page, "Photo Booth");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => !(await window.getAttribute("aria-busy")));
  await window.getByRole("button", { name: "Normal", exact: true }).first().click();
  const video = window.locator(".mac-photo-booth-frame video");
  await video.waitFor({ timeout: 10_000 });
  await until(() => video.evaluate((each) => each.videoWidth > 0));
  await window.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
  const booth = async () =>
    ((await api(page, "GET", "/api/photos/library")).json.photos ?? []).filter(
      (photo) => photo.source === "photo-booth",
    );
  await until(async () => (await booth()).length === 1);
  const [picture] = await booth();
  await window.locator(`[data-picture-id="${picture.id}"]`).click();
  await page.waitForTimeout(500);
  const coming = page.waitForEvent("download", { timeout: 15_000 });
  await chooseMenu(page, "File", "Export…");
  const download = await coming;
  const bytes = readFileSync(await download.path());
  const entry = (await api(page, "GET", "/api/files/")).json.entries.find(
    (each) => each.id === picture.file,
  );
  const shape = bytes[0] === 0xff && bytes[1] === 0xd8 ? "JPEG" : bytes[0] === 0x89 ? "PNG" : "?";
  step(
    "Photo Booth's File > Export… hands over a file of the stored size (camera: a canvas stream)",
    shape !== "?" && bytes.length === entry?.size,
    `${download.suggestedFilename()} ${bytes.length} bytes, ${shape}, stored ${entry?.size}`,
  );
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  await a.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    const draw = () => {
      context.fillStyle = "#308050";
      context.fillRect(0, 0, 640, 480);
    };
    setInterval(draw, 100);
    draw();
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(15);
  });
  for (const page of [a, b]) {
    const catalogue = (await api(page, "GET", "/api/apps")).json.catalogue ?? [];
    const sold = SOLD.filter((app) =>
      catalogue.some((each) => each.id === app && !each.preinstalled),
    );
    const held = (await api(page, "GET", APPS)).json;
    await api(page, "PUT", APPS, { installed: sold, rev: held.rev });
    await reloadDesktop(page);
  }
  const only = (
    process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : ""
  )
    .split(",")
    .filter(Boolean);
  const wanted = (part) => only.length === 0 || only.includes(part);
  if (wanted("music")) await musicRows(a);
  if (wanted("store")) await appStoreRows(a);
  if (wanted("tv")) await tvRows(a);
  if (wanted("chess")) await chessRows(a, b);
  if (wanted("fonts")) await fontBookRows(a);
  if (wanted("booth")) await photoBoothRows(a);
  console.log(`shots and files in ${path.resolve(out)}`);
});

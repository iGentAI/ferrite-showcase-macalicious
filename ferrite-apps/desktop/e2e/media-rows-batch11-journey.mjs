#!/usr/bin/env node
// Music's Convert and Get Album Artwork and Books' store pictures, on the desktop served by
// `ferrite dev`, against the real drive, the real encoders of the browser and the real Project
// Gutenberg. Everything kept is read back from the server. Run it once per browser:
//
//   node e2e/media-rows-batch11-journey.mjs --browser webkit [--url ...] [--out <dir>]
//     AAC and MP3 versions through WebKit's AudioEncoder, each stored file read by ffprobe and
//     decoded whole by ffmpeg, which share no code with the encoder or the M4A muxer.
//   node e2e/media-rows-batch11-journey.mjs [--url ...] [--out <dir>]
//     Chromium, whose AudioEncoder has neither: the rows are dimmed with their reason. Get Album
//     Artwork's sharing, then Books: pg-1400's pictures in the reader, and a picture file of 2.56 MB
//     (pg-35149), whole through ingress.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out, browserName } = options();
const { step, expectRefusal, run } = journey("media-rows-batch11");

const RUN = Date.now().toString(36);
const MUSIC = "/api/music/library";
const APPS = "/api/app-store/library";
const BOOKS = "/api/books/library";
const SECONDS = 3;
const RATE = 44_100;
const GUTENBERG = "https://www.gutenberg.org/cache/epub";

const region = (page, name) => page.getByRole("region", { name, exact: true }).first();
const songs = async (page) => (await api(page, "GET", MUSIC)).json.library?.songs ?? [];
const songCalled = async (page, title) => (await songs(page)).find((each) => each.title === title);

/** Three seconds of two different tones in stereo, as a 16-bit WAV. */
function toneWav() {
  const frames = SECONDS * RATE;
  const out = Buffer.alloc(44 + frames * 4);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + frames * 4, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(RATE, 24);
  out.writeUInt32LE(RATE * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(frames * 4, 40);
  for (let at = 0; at < frames; at += 1) {
    const time = at / RATE;
    out.writeInt16LE(Math.round(12_000 * Math.sin(2 * Math.PI * 440 * time)), 44 + at * 4);
    out.writeInt16LE(Math.round(12_000 * Math.sin(2 * Math.PI * 660 * time)), 46 + at * 4);
  }
  return out;
}

const u32 = (n) => {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(n);
  return out;
};
const synchsafe = (n) =>
  Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);

/** An MP3 of silent frames with ID3 tags, and a picture when it is given one. */
function taggedMp3(title, artist, album, picture) {
  const textFrame = (name, text) => {
    const body = Buffer.concat([Buffer.from([0]), Buffer.from(text, "latin1")]);
    return Buffer.concat([Buffer.from(name), u32(body.length), Buffer.alloc(2), body]);
  };
  const frames = [textFrame("TIT2", title), textFrame("TPE1", artist), textFrame("TALB", album)];
  if (picture) {
    const body = Buffer.concat([
      Buffer.from([0]),
      Buffer.from("image/png\0", "latin1"),
      Buffer.from([3, 0]),
      picture,
    ]);
    frames.push(Buffer.concat([Buffer.from("APIC"), u32(body.length), Buffer.alloc(2), body]));
  }
  const tag = Buffer.concat(frames);
  const sound = Buffer.alloc(417);
  sound.set([0xff, 0xfb, 0x90, 0x00]);
  return Buffer.concat([
    Buffer.from("ID3"),
    Buffer.from([3, 0, 0]),
    synchsafe(tag.length),
    tag,
    ...Array.from({ length: 200 }, () => sound),
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

/** The status and bytes of a same-origin address, read in the page. */
const readBytes = (page, url) =>
  page
    .evaluate(async (address) => {
      const reply = await fetch(address, { credentials: "same-origin" });
      const bytes = new Uint8Array(await reply.arrayBuffer());
      let text = "";
      for (let at = 0; at < bytes.length; at += 32_766) {
        text += btoa(String.fromCharCode(...bytes.subarray(at, at + 32_766)));
      }
      return { status: reply.status, type: reply.headers.get("content-type"), text };
    }, url)
    .then(({ status, type, text }) => ({ status, type, bytes: Buffer.from(text, "base64") }));

async function storedFile(page, song) {
  const { json } = await api(page, "GET", "/api/files/");
  const entry = json.entries.find((each) => each.id === song.source.file);
  const pieces = Math.ceil(entry.size / json.piece_bytes);
  const parts = [];
  for (let piece = 0; piece < pieces; piece += 1) {
    const url = `/api/files/content/${encodeURIComponent(entry.id)}?piece=${piece}&count=1&version=${entry.version ?? 0}`;
    parts.push((await readBytes(page, url)).bytes);
  }
  return Buffer.concat(parts);
}

async function installApps(page, wanted) {
  const catalogue = (await api(page, "GET", "/api/apps")).json.catalogue ?? [];
  const sold = wanted.filter((app) =>
    catalogue.some((each) => each.id === app && !each.preinstalled),
  );
  const held = (await api(page, "GET", APPS)).json;
  const missing = sold.filter((each) => !(held.installed ?? []).includes(each));
  if (missing.length > 0) {
    await api(page, "PUT", APPS, {
      installed: [...(held.installed ?? []), ...missing],
      rev: held.rev,
    });
    await reloadDesktop(page);
  }
}

async function openApp(page, name) {
  await page
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .or(page.getByRole("link", { name: new RegExp(`^${name}$`) }))
    .first()
    .click();
  const window = region(page, name);
  await window.waitFor({ state: "visible", timeout: 20_000 });
  return window;
}

async function addSongs(page, files, count) {
  const input = page.locator('input[type="file"][aria-label="Add to Library"]');
  await input.waitFor({ state: "attached", timeout: 15_000 });
  await input.setInputFiles(files);
  return until(async () => (await songs(page)).length === count, 30_000);
}

async function selectSong(page, title) {
  const window = region(page, "Music");
  await window.getByRole("treeitem", { name: "Songs", exact: true }).first().click();
  await window
    .getByRole("row", { name: new RegExp(title) })
    .first()
    .click();
}

const ffprobe = (file) =>
  JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], {
      encoding: "utf8",
    }),
  );
/** Decodes the file whole: what ffmpeg complains of, and how loud the sound it got is. */
function ffmpegDecode(file) {
  const said = execFileSync(
    "bash",
    ["-c", 'ffmpeg -hide_banner -nostats -i "$0" -af volumedetect -f null - 2>&1', file],
    { encoding: "utf8" },
  );
  return {
    errors: said.split("\n").filter((line) => /error|invalid|corrupt/i.test(line)),
    mean: Number(/mean_volume: (-?[\d.]+) dB/.exec(said)?.[1]),
  };
}

/** Writes the stored file out and has ffprobe and ffmpeg read it. */
async function proveVersion(page, song, wanted) {
  const bytes = await storedFile(page, song);
  const file = path.join(out, `batch11-${song.source.name}`);
  writeFileSync(file, bytes);
  const { streams, format } = ffprobe(file);
  const [stream] = streams;
  step(
    `ffprobe reads the stored ${wanted.extension} as ${wanted.codec}, stereo at ${RATE} Hz, about ${SECONDS} s`,
    streams.length === 1 &&
      stream.codec_name === wanted.codec &&
      stream.channels === 2 &&
      Number(stream.sample_rate) === RATE &&
      Math.abs(Number(format.duration) - SECONDS) < wanted.leeway &&
      format.format_name.includes(wanted.container),
    JSON.stringify({
      codec: stream?.codec_name,
      profile: stream?.profile,
      channels: stream?.channels,
      rate: stream?.sample_rate,
      duration: format.duration,
      format: format.format_name,
      size: bytes.length,
    }),
  );
  const decoded = ffmpegDecode(file);
  step(
    `ffmpeg decodes the whole ${wanted.extension} without complaint, and it holds the tone`,
    decoded.errors.length === 0 && decoded.mean > -30,
    JSON.stringify(decoded),
  );
  const inPage = await page.evaluate(
    async ({ data }) => {
      const buffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
      const sound = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(buffer);
      return { duration: sound.duration, channels: sound.numberOfChannels };
    },
    { data: bytes.toString("base64") },
  );
  step(
    `the browser decodes the stored ${wanted.extension} too`,
    inPage.duration >= 2.99 && inPage.duration < 3.2 && inPage.channels === 2,
    JSON.stringify(inPage),
  );
  const element = await page.evaluate(
    ({ data, type }) =>
      new Promise((resolve) => {
        const audio = new Audio();
        const say = (event) => () =>
          resolve({ event, ready: audio.readyState, duration: String(audio.duration) });
        audio.onloadeddata = say("loaded");
        audio.onerror = say("error");
        audio.src = URL.createObjectURL(
          new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type }),
        );
        setTimeout(say("nothing"), 10_000);
      }),
    { data: bytes.toString("base64"), type: song.source.type },
  );
  step(
    `an audio element, which is what Music plays with, loads the ${wanted.extension}`,
    element.event === "loaded",
    JSON.stringify(element),
  );
}

async function convertRows(page) {
  await openApp(page, "Music");
  const title = `Tone ${RUN}`;
  const had = (await songs(page)).length;
  step(
    "a real song is on the drive and in the library",
    await addSongs(
      page,
      [{ name: `${title}.wav`, mimeType: "audio/wav", buffer: toneWav() }],
      had + 1,
    ),
  );
  await selectSong(page, title);
  const made = async (name) => {
    const find = async () => (await songs(page)).find((each) => each.source.name === name);
    await until(async () => Boolean(await find()), 30_000);
    return find();
  };
  if (browserName === "webkit") {
    for (const row of ["Create AAC Version", "Create MP3 Version"]) {
      const state = await menuItemState(page, "File", "Convert", row);
      step(`${row} can be chosen in WebKit`, state.disabled === false, JSON.stringify(state));
    }
    await chooseMenu(page, "File", "Convert", "Create AAC Version");
    const aac = await made(`${title}.m4a`);
    step(
      "Create AAC Version keeps a new song, with the first's details, as an M4A of the drive",
      aac?.title === title && aac?.source?.type === "audio/mp4",
      JSON.stringify(
        aac?.source ?? (await page.locator(".mac-music-desktop-status").allInnerTexts()),
      ),
    );
    await proveVersion(page, aac, {
      extension: "m4a",
      codec: "aac",
      container: "mp4",
      leeway: 0.2,
    });
    await selectSong(page, title);
    await chooseMenu(page, "File", "Convert", "Create MP3 Version");
    const mp3 = await made(`${title}.mp3`);
    step(
      "Create MP3 Version keeps a new song, as an MP3 of the drive",
      mp3?.title === title &&
        mp3?.source?.type === "audio/mpeg" &&
        Math.abs(mp3?.duration - SECONDS) < 0.2,
      JSON.stringify(
        mp3?.source ?? (await page.locator(".mac-music-desktop-status").allInnerTexts()),
      ),
    );
    await proveVersion(page, mp3, {
      extension: "mp3",
      codec: "mp3",
      container: "mp3",
      leeway: 0.4,
    });
    await reloadDesktop(page);
    const kept = (await songs(page))
      .map((each) => each.source.name)
      .filter((each) => each.startsWith(title))
      .sort();
    step(
      "all three files are in the library across a reload",
      JSON.stringify(kept) === JSON.stringify([`${title}.m4a`, `${title}.mp3`, `${title}.wav`]),
      kept.join(", "),
    );
    await shot(page, path.join(out, "batch11-webkit-versions.png"));
    return;
  }
  const wav = await menuItemState(page, "File", "Convert", "Create WAV Version");
  step("Create WAV Version can be chosen where there is no such encoder", wav.disabled === false);
  for (const [row, name] of [
    ["Create AAC Version", "AAC"],
    ["Create MP3 Version", "MP3"],
  ]) {
    const state = await menuItemState(page, "File", "Convert", row);
    step(
      `${row} is dimmed in Chromium, saying why`,
      state.disabled === true &&
        state.title ===
          `This browser's AudioEncoder has no ${name} encoder for a page: Music writes WAV here.`,
      JSON.stringify(state),
    );
  }
}

async function artworkRows(page) {
  const status = page.locator(".mac-music-desktop-status");
  const sleeve = await pngOf(page, "#ff8000");
  const album = `Sleeve ${RUN}`;
  const before = (await songs(page)).length;
  const artist = `Ada ${RUN}`;
  step(
    "an album of three songs is added, one with a picture in its file",
    await addSongs(
      page,
      [
        {
          name: `side-a-${RUN}.mp3`,
          mimeType: "audio/mpeg",
          buffer: taggedMp3(`Side A ${RUN}`, artist, album, sleeve),
        },
        {
          name: `side-b-${RUN}.mp3`,
          mimeType: "audio/mpeg",
          buffer: taggedMp3(`Side B ${RUN}`, artist, album, null),
        },
        {
          name: `side-c-${RUN}.mp3`,
          mimeType: "audio/mpeg",
          buffer: taggedMp3(`Side C ${RUN}`, artist, album, null),
        },
        {
          name: `other-${RUN}.mp3`,
          mimeType: "audio/mpeg",
          buffer: taggedMp3(`Other ${RUN}`, `Ben ${RUN}`, album, null),
        },
      ],
      before + 4,
    ),
  );
  const digest = (await songCalled(page, `Side A ${RUN}`))?.artwork;
  step(
    "only the song whose file has one holds a picture yet",
    Boolean(digest) && (await songCalled(page, `Side B ${RUN}`))?.artwork === null,
    String(digest),
  );
  await until(async () => {
    const state = await menuItemState(page, "File", "Library", "Get Album Artwork");
    return state.disabled === false;
  }, 10_000);
  await chooseMenu(page, "File", "Library", "Get Album Artwork");
  await status.getByText(/album/i).waitFor({ timeout: 20_000 });
  const said = (await status.innerText()).split("\n")[0];
  step(
    "Get Album Artwork says what it shared",
    said === "2 songs took the picture of another song of the album.",
    said,
  );
  await status.getByRole("button", { name: "OK" }).click();
  const shared = await until(
    async () =>
      (await songCalled(page, `Side B ${RUN}`))?.artwork === digest &&
      (await songCalled(page, `Side C ${RUN}`))?.artwork === digest,
    10_000,
  );
  step("the album's other songs name the same stored picture", shared);
  step(
    "a song of another artist with that album's name shares nothing",
    (await songCalled(page, `Other ${RUN}`))?.artwork === null,
  );

  const pictureStatus = async () => (await readBytes(page, `/api/music/artwork/${digest}`)).status;
  const deleteSong = async (title) => {
    await selectSong(page, title);
    await chooseMenu(page, "Song", "Delete from Library");
    await page.getByRole("button", { name: "Move to Trash", exact: true }).click();
    return until(async () => !(await songCalled(page, title)), 15_000);
  };
  step("the song whose file held the picture is deleted", await deleteSong(`Side A ${RUN}`));
  await page.waitForTimeout(1_000);
  step(
    "the others keep it: the song still names it and the server still has its bytes",
    (await songCalled(page, `Side B ${RUN}`))?.artwork === digest &&
      (await pictureStatus()) === 200,
  );
  await reloadDesktop(page);
  await openApp(page, "Music");
  const window = region(page, "Music");
  await window.getByRole("treeitem", { name: "Albums", exact: true }).first().click();
  const image = window.locator(`img[src="/api/music/artwork/${digest}"]`).first();
  await image.waitFor({ timeout: 10_000 });
  step(
    "and the Albums view draws it across a reload",
    await until(() => image.evaluate((each) => each.complete && each.naturalWidth > 0), 10_000),
  );
  await shot(page, path.join(out, "batch11-shared-artwork.png"));
  await deleteSong(`Side B ${RUN}`);
  await deleteSong(`Side C ${RUN}`);
  expectRefusal(404, `/api/music/artwork/${digest}`);
  step(
    "with the last song that names it gone, the stored picture goes too",
    await until(async () => (await pictureStatus()) === 404, 15_000),
  );
}

/** Asks for a book's text until it is all kept, as the reader does, and answers its text. */
async function keptText(page, book) {
  const route = `/api/books/text/${book}`;
  for (let round = 0; round < 200; round += 1) {
    const { json } = await api(page, "GET", route);
    if (json.complete) {
      const parts = [];
      for (let part = 0; part < json.parts.length; part += 1) {
        parts.push((await api(page, "GET", `${route}/${part}`)).json.text);
      }
      return { index: json, text: parts.join("") };
    }
    await api(page, "GET", `${route}/${json.parts.length}`);
  }
  throw new Error(`${book}: its text never completed`);
}

async function pictureList(page, book) {
  for (let round = 0; round < 60; round += 1) {
    const { json, status } = await api(page, "GET", `/api/books/pictures/${book}`);
    if (status !== 200) throw new Error(`${book}: pictures answered ${status}`);
    if (json.complete) return { pictures: json.pictures, rounds: round + 1 };
  }
  throw new Error(`${book}: its picture list never completed`);
}

async function bookRows(page) {
  const { index, text } = await keptText(page, "pg-1400");
  const { pictures, rounds } = await pictureList(page, "pg-1400");
  console.log(
    `pg-1400 pictures in ${rounds} rounds: ${JSON.stringify(
      pictures.map(({ at, path }) => [at, path, text.slice(at, at + 40)]),
    )}`,
  );
  step(
    "pg-1400's HTML edition gives pictures in the order of the text, each in the text and at a paragraph",
    pictures.length === 16 &&
      pictures[1].at === 1784 &&
      pictures[1].path === "images/0012m.jpg" &&
      text.slice(1784).startsWith("[Illustration]\n\nChapter I.") &&
      !pictures.some((each) => each.path === "images/enlarge.jpg") &&
      pictures.every(
        (each, at) =>
          each.type === "image/jpeg" &&
          each.at < text.length &&
          (each.at === 0 || text.slice(each.at - 2, each.at) === "\n\n") &&
          (at === 0 || pictures[at - 1].at <= each.at),
      ),
    `${pictures.length} pictures, ${text.length} characters`,
  );
  const after = await keptText(page, "pg-1400");
  step(
    "the text and its offsets are what they were",
    after.text === text && JSON.stringify(after.index.parts) === JSON.stringify(index.parts),
  );
  const again = await pictureList(page, "pg-1400");
  step(
    "asking again reads nothing more and answers the same list",
    again.rounds === 1 && JSON.stringify(again.pictures) === JSON.stringify(pictures),
  );

  const held = (await api(page, "GET", BOOKS)).json;
  await api(page, "PUT", BOOKS, {
    library: {
      collections: [],
      pages: {},
      marks: {},
      sort: "recent",
      ...held.library,
      books: [
        ...(held.library?.books ?? []).filter((each) => each.id !== "pg-1400"),
        {
          id: "pg-1400",
          title: "Great Expectations",
          author: "Charles Dickens",
          source: "gutenberg",
          added: Date.now(),
        },
      ],
    },
    rev: held.rev,
  });
  const chosen = pictures[Math.floor(pictures.length / 2)];
  const reading = (await api(page, "GET", "/api/books/reading/pg-1400")).json;
  await api(page, "PUT", "/api/books/reading/pg-1400", {
    reading: { ...reading.reading, place: chosen.at },
    rev: reading.rev,
  });
  await reloadDesktop(page);
  const books = await openApp(page, "Books");
  await books
    .getByRole("group", { name: "View" })
    .getByRole("button", { name: "Library", exact: true })
    .first()
    .click();
  await books
    .getByRole("button", { name: /^Great Expectations/ })
    .first()
    .dblclick();
  const sheet = page.locator(".mac-books-text:not(.mac-books-text-measure)").first();
  await sheet.waitFor({ timeout: 30_000 });
  let shown = null;
  await until(async () => {
    const state = await sheet.evaluate((element) => {
      const image = element.querySelector(`img[data-book-picture]`);
      const before = document.createRange();
      before.selectNodeContents(element);
      if (image) before.setEndBefore(image);
      return image
        ? {
            path: image.dataset.bookPicture,
            start: Number(element.dataset.pageStart),
            end: Number(element.dataset.pageEnd),
            at: Number(element.dataset.pageStart) + before.toString().length,
            drawn: image.complete && image.naturalWidth > 0,
            width: image.naturalWidth,
            words: element.textContent,
          }
        : false;
    });
    if (!state?.drawn) return false;
    shown = state;
    return true;
  }, 30_000);
  step(
    "the reader draws the picture from the source at its own offset, opened at that place",
    shown?.path === chosen.path && shown?.at === chosen.at && shown?.width > 100,
    JSON.stringify({ ...shown, words: undefined, wanted: chosen }),
  );
  step(
    "and the page's words are exactly the book's text from its offset",
    shown?.words === text.slice(shown?.start, shown?.end),
    `${shown?.start}-${shown?.end}`,
  );
  await shot(page, path.join(out, "batch11-books-pg-1400.png"));

  await keptText(page, "pg-35149");
  const large = await pictureList(page, "pg-35149");
  const coverAt = large.pictures.findIndex((each) => each.path === "images/cover.jpg");
  const coverSource = Buffer.from(
    await (await fetch(`${GUTENBERG}/35149/images/cover.jpg`)).arrayBuffer(),
  );
  const cover = await readBytes(page, `/api/books/pictures/pg-35149/${coverAt}`);
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  step(
    "a picture of 2.56 MB comes whole through the server and ingress, byte for byte",
    coverAt >= 0 &&
      coverSource.length > 2_500_000 &&
      cover.status === 200 &&
      cover.type === "image/jpeg" &&
      sha(cover.bytes) === sha(coverSource),
    `${cover.status} ${cover.bytes.length} of ${coverSource.length} bytes`,
  );
}

await run(async (page) => {
  page.setDefaultTimeout(20_000);
  await openDesktop(page, base, step);
  await installApps(page, ["music", "books"]);
  await convertRows(page);
  if (browserName !== "webkit") {
    await artworkRows(page);
    await bookRows(page);
  }
});

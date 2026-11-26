#!/usr/bin/env node
// The small rows of batch 12 on the desktop served by `ferrite dev`, with a real microphone device, encoders and accounts:
// a Voice Memos recording shared into Mail and Messages and its bytes read back from what the other person received;
// QuickTime Player's Share into Mail and Photo Booth's into Messages; a song found by name through Siri and played; a
// script's Description and bundle fields kept in its file and found again in a copy; Stickies' Paste by the menu and the
// key, with a picture; a Podcasts' new episode from NPR's feed told, pressed and opened; QuickTime's Timer, and an export
// and a Rotate read back by ffprobe and ffmpeg, which share no code with the encoder or the muxer; and Mail's Use
// Selection for Find by its key, thirty times over. The camera, the microphone and the screen picker are Chromium's fake
// devices. Exits 0 only when every step passed and no page logged a problem.
//
//   node e2e/small-rows-batch12-journey.mjs [--url http://127.0.0.1:8787] [--out dir]
//   ONLY=voice,siri,script,stickies,podcasts,quicktime,find selects parts.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, options, reloadDesktop } from "./app-journey.mjs";
import { compose, row, send, viewer } from "./mail-organize-kit.mjs";
import { chooseMenu, trackMedia, until } from "./media-census-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { out } = options();
mkdirSync(out, { recursive: true });
const here = path.dirname(fileURLToPath(import.meta.url));
const { step, run, shot, allow } = twoPeople("small-rows-batch12");
const only = process.env.ONLY?.split(",") ?? [
  "voice",
  "siri",
  "script",
  "stickies",
  "podcasts",
  "quicktime",
  "find",
];
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `s12chris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `s12martin-${id}`, fullName: `Martin ${id}`, password };
const SONG = `Zephyr Tune ${id}`;
const LIBRARY = "/api/app-store/library";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bytes the page fetches with its own cookie. */
const bytesAt = (page, url) =>
  page
    .evaluate(async (at) => {
      const reply = await fetch(at, { credentials: "same-origin" });
      const held = new Uint8Array(await reply.arrayBuffer());
      let text = "";
      for (const byte of held) text += String.fromCharCode(byte);
      return { status: reply.status, text: btoa(text) };
    }, url)
    .then(({ status, text }) => {
      if (status !== 200) throw new Error(`${url}: HTTP ${status}`);
      return Buffer.from(text, "base64");
    });

/** The whole of an attachment, piece by piece as the apps read it. */
async function attachmentBytes(page, { url, size }) {
  const parts = [];
  let held = 0;
  for (let piece = 0; held < size; piece += 1) {
    const part = await bytesAt(page, `${url}?piece=${piece}&count=1`);
    if (part.length === 0) break;
    parts.push(part);
    held += part.length;
  }
  return Buffer.concat(parts);
}

const drive = async (page) => (await api(page, "GET", "/api/files/")).json;

async function fileBytes(page, entry) {
  const { piece_bytes: size } = await drive(page);
  const pieces = Math.max(1, Math.ceil(entry.size / size));
  const parts = [];
  for (let piece = 0; piece < pieces; piece += 1) {
    parts.push(
      await bytesAt(
        page,
        `/api/files/content/${encodeURIComponent(entry.id)}?piece=${piece}&count=1&version=${entry.version ?? 0}`,
      ),
    );
  }
  return Buffer.concat(parts);
}

const liveFile = async (page, test) =>
  ((await drive(page)).entries ?? []).find(
    (each) => each.kind === "file" && each.trashed_ms === undefined && test(each),
  );

async function install(page, apps) {
  const held = (await api(page, "GET", LIBRARY)).json;
  await api(page, "PUT", LIBRARY, {
    installed: [...new Set([...(held.installed ?? []), ...apps])],
    rev: held.rev,
  });
  await reloadDesktop(page);
}

async function spotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

const messagesOf = (page) => page.locator('.mac-messages[aria-label="Messages"]').first();

/** The files in the person's conversations, each with where its bytes are. */
async function received(page) {
  const { json: list } = await api(page, "GET", "/api/messages/conversations");
  const found = [];
  for (const { id: conversation } of list?.conversations ?? []) {
    const { json } = await api(page, "GET", `/api/messages/conversations/${conversation}`);
    for (const message of json?.state?.messages ?? []) {
      for (const each of message.attachments ?? []) {
        found.push({
          name: each.name,
          size: each.size,
          url: `/api/messages/conversations/${conversation}/attachments/${each.id}`,
        });
      }
    }
  }
  return found;
}

/** The files in the person's mail, each with where its bytes are. */
async function mailed(page) {
  const { json } = await api(page, "GET", "/api/mail/messages");
  return (json?.messages ?? []).flatMap((message) =>
    (message.attachments ?? []).map((each) => ({
      name: each.name,
      size: each.size,
      mailbox: message.mailbox,
      url: `/api/mail/messages/${message.id}/attachments/${each.id}`,
    })),
  );
}

const attachmentIn = (window, name) =>
  window
    .getByRole("list", { name: "Attachments" })
    .getByRole("listitem")
    .filter({ hasText: name })
    .first();

/** Addresses the New Message in front and sends it; the window closes. */
async function sendMail(page, to, subject) {
  const window = compose(page);
  const field = window.getByLabel("To:");
  await field.click();
  await field.pressSequentially(to);
  await field.press("Enter");
  await window.getByLabel("Subject:").fill(subject);
  // Send refuses, and says so, until the attachment has finished uploading.
  const gone = await until(async () => {
    if ((await window.count()) === 0) return true;
    await window
      .getByRole("button", { name: "Send" })
      .click({ timeout: 2_000 })
      .catch(() => {});
    await pause(1_000);
    return (await window.count()) === 0;
  }, 60_000);
  if (!gone) throw new Error(`the message "${subject}" was not sent`);
}

async function voiceAndShares(a, b) {
  await install(a, ["voice-memos", "quicktime-player", "photo-booth"]);
  await spotlight(a, "Voice Memos");
  const win = a.locator('.mac-managed-window[data-window-id="voice-memos"]').first();
  await win.waitFor({ timeout: 15_000 });
  await until(async () => (await win.getByRole("button", { name: "New Recording" }).count()) > 0);
  const before = await win.getByRole("option").count();
  await chooseMenu(a, "File", "New Recording");
  await win.getByRole("button", { name: "Pause Recording" }).waitFor({ timeout: 15_000 });
  await a.waitForTimeout(2_500);
  await win.getByRole("button", { name: "Done", exact: true }).click();
  await until(async () => (await win.getByRole("option").count()) === before + 1, 20_000);
  const first = win.getByRole("option").first();
  await until(async () => !/Saving|Not saved/.test(await first.innerText()), 20_000);
  const title = (await first.innerText()).split("\n")[0];
  await first.click();
  const memo = await liveFile(a, (each) => each.name.startsWith(title));
  const stored = await fileBytes(a, memo);
  step(
    "a recording made here is on the drive",
    stored.length > 1000,
    `${memo.name}, ${stored.length} B`,
  );

  await chooseMenu(a, "File", "Share", "Mail");
  const held = attachmentIn(compose(a), memo.name);
  step(
    "Voice Memos' Share > Mail attaches the recording to a new message",
    await until(() => held.isVisible(), 15_000),
  );
  await shot(a, "batch12-voice-mail");
  const subject = `Memo ${id}`;
  await sendMail(a, martin.name, subject);
  const inbox = await within(20_000, async () =>
    (await mailed(b)).some((each) => each.name === memo.name),
  );
  const got = (await mailed(b)).find((each) => each.name === memo.name);
  step(
    "sent, the other person's mail holds the recording's own bytes",
    inbox !== null && got && Buffer.compare(await attachmentBytes(b, got), stored) === 0,
    got ? `${got.mailbox}, ${got.name}` : "nothing arrived",
  );

  await spotlight(a, "Voice Memos");
  await first.click();
  await chooseMenu(a, "File", "Share", "Messages");
  const carried = messagesOf(a).getByRole("list", { name: "Files to send" });
  step(
    "Voice Memos' Share > Messages starts a new message carrying the recording",
    await until(() => carried.getByText(memo.name).isVisible(), 15_000),
  );
  await messagesOf(a).getByRole("textbox", { name: "To" }).fill(martin.name);
  await messagesOf(a).getByRole("textbox", { name: "Message" }).press("Enter");
  await within(20_000, async () => (await received(b)).some((each) => each.name === memo.name));
  const there = (await received(b)).find((each) => each.name === memo.name);
  step(
    "sent, the other person's conversation holds the recording's own bytes",
    there && Buffer.compare(await attachmentBytes(b, there), stored) === 0,
    there?.name ?? "nothing arrived",
  );
  await openFromDock(b, "Messages", "Messages").catch(() => {});
  await messagesOf(b)
    .getByRole("listbox", { name: "Conversations" })
    .getByRole("option")
    .filter({ hasText: chris.fullName })
    .first()
    .click();
  const listed = messagesOf(b)
    .getByRole("list", { name: "Attachments" })
    .getByRole("listitem")
    .filter({ hasText: memo.name });
  step(
    "and the conversation shows it by name to the other person",
    await until(() => listed.first().isVisible(), 20_000),
  );
  const heard = path.join(out, `received-${id}.webm`);
  if (there) writeFileSync(heard, await attachmentBytes(b, there));
  const sound = there ? ffmpegReads(heard) : { errors: ["nothing arrived"], mean: Number.NaN };
  step(
    "what arrived decodes as sound, by ffmpeg",
    sound.errors.length === 0 && sound.mean > -91,
    `${sound.errors.join("; ")} mean ${sound.mean} dB`,
  );
  await shot(b, "batch12-voice-messages");

  await spotlight(a, "QuickTime Player");
  const qt = a.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  await qt.waitFor({ state: "visible", timeout: 15_000 });
  const fixture = readFileSync(path.join(here, "fixtures", "test-pattern.webm"));
  const chooser = a.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await chooser).setFiles(path.join(here, "fixtures", "test-pattern.webm"));
  await until(() =>
    qt.locator("video.mac-quicktime-player-video").evaluate((each) => each.videoWidth > 0),
  );
  await chooseMenu(a, "File", "Share", "Mail");
  step(
    "QuickTime Player's Share > Mail attaches the movie to a new message",
    await until(() => attachmentIn(compose(a), "test-pattern").isVisible(), 20_000),
  );
  await sendMail(a, martin.name, `Movie ${id}`);
  const movie = await until(async () =>
    (await mailed(b)).some((each) => each.name.startsWith("test-pattern")),
  );
  const movieFile = (await mailed(b)).find((each) => each.name.startsWith("test-pattern"));
  step(
    "and the other person's mail holds the movie's own bytes",
    movie && Buffer.compare(await attachmentBytes(b, movieFile), fixture) === 0,
    movieFile?.name,
  );
  await qt
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();

  await spotlight(a, "Photo Booth");
  const booth = a.getByRole("region", { name: "Photo Booth", exact: true }).first();
  await booth.waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => !(await booth.getAttribute("aria-busy")));
  await booth.getByRole("button", { name: "Normal", exact: true }).first().click();
  await until(() =>
    booth.locator(".mac-photo-booth-frame video").evaluate((each) => each.videoWidth > 0),
  );
  const photos = async () => (await api(a, "GET", "/api/photos/library")).json.photos ?? [];
  const shots = (await photos()).length;
  await booth.getByRole("button", { name: "Take Photo" }).click({ modifiers: ["Alt"] });
  await until(async () => (await photos()).length === shots + 1);
  await booth
    .locator(".mac-photo-booth-strip button, .mac-photo-booth-strip [role=option]")
    .first()
    .click();
  const had = (await received(b)).length;
  await chooseMenu(a, "File", "Share", "Messages");
  await until(async () => (await carried.count()) > 0, 15_000);
  const taken = (await carried.innerText()).trim();
  await messagesOf(a).getByRole("textbox", { name: "To" }).fill(martin.name);
  await messagesOf(a).getByRole("textbox", { name: "Message" }).press("Enter");
  await until(async () => (await received(b)).length === had + 1, 20_000);
  const picture = (await received(b)).at(-1);
  const pictureBytes = picture ? await attachmentBytes(b, picture) : Buffer.alloc(0);
  step(
    "Photo Booth's Share > Messages sends the picture, a JPEG or PNG the other person can read",
    pictureBytes.length > 1000 &&
      (pictureBytes[0] === 0xff || pictureBytes.subarray(1, 4).toString() === "PNG"),
    `${taken}, ${pictureBytes.length} B`,
  );
}

/** Eight seconds of a tone as a 16-bit WAV. */
function toneWav() {
  const rate = 22_050;
  const frames = rate * 8;
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + frames * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(frames * 2, 40);
  for (let at = 0; at < frames; at += 1) {
    wav.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * at) / rate)), 44 + at * 2);
  }
  return wav;
}

async function siriPlays(a) {
  // Among the elements played, the last with a file behind it: a Photo Booth window the reload put
  // back plays the camera's live picture, which has no source and whose time also moves.
  const songMedia = () =>
    a.evaluate(() => {
      const media = (window.__r7Media ?? []).filter((each) => each.currentSrc).at(-1);
      return media
        ? { paused: media.paused, currentTime: media.currentTime, duration: media.duration }
        : null;
    });
  await openFromDock(a, "Music", "Music");
  const input = a.locator('input[type="file"][aria-label="Add to Library"]');
  await input.waitFor({ state: "attached", timeout: 15_000 });
  const file = path.join(out, `${SONG}.wav`);
  writeFileSync(file, toneWav());
  await input.setInputFiles(file);
  const songs = async () => (await api(a, "GET", "/api/music/library")).json.library?.songs ?? [];
  step(
    "a real song is in Music's library on the server",
    await until(async () => (await songs()).some((each) => each.title === SONG), 30_000),
  );
  await a.waitForTimeout(1_500);
  await reloadDesktop(a);
  const before = await songMedia();
  step(
    "after a reload nothing is playing",
    before === null || before.paused,
    JSON.stringify(before),
  );

  await a.getByRole("menuitem", { name: "Siri", exact: true }).first().click();
  const field = a.getByRole("textbox", { name: "Type to Siri" });
  await field.waitFor({ timeout: 8_000 });
  await field.fill(`play ${SONG.toLowerCase()}`);
  await field.press("Enter");
  const said = a.locator("[data-answer]");
  const named = await until(
    async () => (await said.innerText()).trim() === `Playing “${SONG}”.`,
    25_000,
  );
  step(
    "Siri finds the song by name through Spotlight and says it plays it",
    named,
    await said.innerText().catch(() => "no answer"),
  );
  let at = null;
  const moves = await until(async () => {
    const media = await songMedia();
    if (!media || media.paused || Math.abs(media.duration - 8) > 0.2) return false;
    at ??= media.currentTime;
    return media.currentTime > at + 0.4;
  }, 15_000);
  step(
    "and the page's one player plays it, its time moving",
    moves,
    JSON.stringify(await songMedia()),
  );
  const window = a.getByRole("region", { name: "Music", exact: true }).first();
  step(
    "Music opens with the song in Now Playing",
    await until(async () =>
      (await window.getByRole("group", { name: "Now Playing" }).innerText()).includes(SONG),
    ),
  );
  await shot(a, "batch12-siri-song");
  await field.fill("pause the music");
  await field.press("Enter");
  step(
    "“pause the music” then pauses that player",
    await until(async () => (await songMedia())?.paused === true, 5_000),
  );
}

async function scriptKept(a) {
  await install(a, ["script-editor"]);
  await spotlight(a, "Script Editor");
  const script = a.getByRole("textbox", { name: "Script", exact: true });
  await script.waitFor({ state: "visible", timeout: 15_000 });
  await a.waitForTimeout(600);
  const window = a.locator('.mac-managed-window[data-window-id^="script-editor"]').first();
  await window.getByRole("combobox", { name: "Language" }).click();
  await a.getByRole("option", { name: "JavaScript" }).click();
  await script.click();
  await a.keyboard.press("ControlOrMeta+a");
  const CODE = `return "kept ${id}";`;
  await a.keyboard.type(CODE);
  const WORDS = `Tells */ the time ${id}`;
  await window.getByRole("button", { name: "Description" }).first().click();
  const description = window.getByRole("textbox", { name: "Description" });
  await description.click();
  await a.keyboard.type(WORDS);
  await window.getByRole("button", { name: "Bundle contents" }).click();
  await window.getByRole("textbox", { name: "Version:" }).fill("2.5");
  await window.getByRole("textbox", { name: "Identifier:" }).fill(`com.example.${id}`);
  await window.getByRole("button", { name: "Save Script" }).click();
  const sheet = a.getByRole("dialog", { name: "Save Script" });
  await sheet.waitFor({ timeout: 10_000 });
  const name = `Kept ${id}`;
  await sheet.getByRole("textbox", { name: "Save As:" }).fill(name);
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await sheet.waitFor({ state: "detached", timeout: 15_000 });
  const file = await until(async () => Boolean(await liveFile(a, (e) => e.name === `${name}.js`)));
  const entry = await liveFile(a, (each) => each.name === `${name}.js`);
  const text = (await fileBytes(a, entry)).toString();
  step(
    "Save writes the code, then the Description and bundle fields as a comment on its last line",
    file &&
      text.startsWith(`${CODE}\n/* Script Editor: {`) &&
      text.endsWith("*/\n") &&
      text.includes(`Tells *\\u002f the time ${id}`) &&
      text.includes('"version":"2.5"'),
    text.slice(0, 120),
  );
  const { json: settings } = await api(a, "GET", "/api/system-preferences/settings");
  step(
    "nothing is kept beside the file among the person's values",
    !Object.keys(settings.values ?? {}).some((key) => key.startsWith("scriptEditor.info.")),
  );

  // The operation Finder's Duplicate sends: a new file, a new id, nothing but the bytes in common.
  const parent = entry.parent;
  const copied = await api(a, "POST", "/api/files/ops", {
    ops: [{ op: "copy", id: entry.id, parent, existing: "rename" }],
  });
  const copyId = copied.json.created?.[0];
  const copy = await liveFile(a, (each) => each.id === copyId);
  step("the drive copies the file under a new id", copy && copy.id !== entry.id, copy?.name);

  await window.getByRole("button", { name: "Open Script" }).click();
  await a
    .getByRole("menuitem", { name: copy.name.replace(/\.js$/, "") })
    .first()
    .click();
  const held = async () => (await script.innerText()).trim();
  step(
    "the copy opens in Script Editor with the code alone in the view",
    await until(async () => (await held()) === CODE),
    await held(),
  );
  await window.getByRole("button", { name: "Description" }).first().click();
  step(
    "its Description is the one saved",
    await until(async () => (await description.innerText()).includes(WORDS)),
    await description.innerText(),
  );
  await shot(a, "batch12-script-copy");
  step(
    "and its bundle fields",
    await until(
      async () =>
        (await window.getByRole("textbox", { name: "Version:" }).inputValue()) === "2.5" &&
        (await window.getByRole("textbox", { name: "Identifier:" }).inputValue()) ===
          `com.example.${id}`,
    ),
  );
  await window.getByRole("button", { name: "Run" }).first().click();
  const result = window.getByRole("textbox", { name: "Result" });
  step(
    "the script runs as it did, the comment nothing to it",
    await until(async () => (await result.inputValue()).includes(`kept ${id}`)),
  );
  const directly = await api(a, "POST", "/api/script-editor/run", { code: text });
  step(
    "as does the file as it stands, handed to the script host whole",
    directly.status === 200 && JSON.stringify(directly.json).includes(`kept ${id}`),
    `HTTP ${directly.status}`,
  );
}

async function stickiesPaste(a) {
  await a.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openFromDock(a, "Stickies", "Stickies").catch(() => {});
  await a.locator('[data-window-id^="stickies"]').first().waitFor({ timeout: 10_000 });
  await a.waitForTimeout(600);
  await chooseMenu(a, "File", "New Note");
  await a.waitForTimeout(400);
  const tag = `Sticky${id}`;
  await a.keyboard.type(`${tag} `);
  const note = a.locator(".mac-stickies-note-text", { hasText: tag });
  await a.waitForTimeout(300);
  const saved = async () =>
    ((await api(a, "GET", "/api/stickies/data")).json?.data?.notes ?? []).find((each) =>
      each.text.includes(tag),
    );
  const PASTED = `menu${id}`;
  await a.evaluate((words) => navigator.clipboard.writeText(words), PASTED);
  await chooseMenu(a, "Edit", "Paste");
  step(
    "Edit > Paste by the menu puts the clipboard's words in the note, kept on the server",
    await until(async () => (await saved())?.text.includes(PASTED), 10_000),
    (await saved())?.text,
  );

  await a.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const draw = canvas.getContext("2d");
    draw.fillStyle = "#3366cc";
    draw.fillRect(0, 0, 64, 48);
    const png = await new Promise((done) => canvas.toBlob(done, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  });
  await note.click();
  await a.keyboard.press("ControlOrMeta+v");
  step(
    "the key pastes a picture from the clipboard into the note, drawn",
    await until(
      async () => (await note.locator("img").evaluate((each) => each.naturalWidth)) === 64,
      10_000,
    ),
  );
  step(
    "and the server keeps it in the note as the picture itself",
    await until(
      async () => /<img src="data:image\/\w+;base64,/.test((await saved())?.html ?? ""),
      10_000,
    ),
  );
  await shot(a, "batch12-stickies-paste");

  await a.evaluate((words) => navigator.clipboard.writeText(words), `after${id}`);
  await note.click();
  // A stand-in for a browser that refuses the read: Chromium grants it here, so the reads are made to reject.
  await a.evaluate(() => {
    for (const read of ["read", "readText"]) {
      Object.defineProperty(navigator.clipboard, read, {
        configurable: true,
        value: () => Promise.reject(new DOMException("Read permission denied.", "NotAllowedError")),
      });
    }
  });
  await chooseMenu(a, "Edit", "Paste");
  const said = a.getByText("This browser keeps the clipboard from menus");
  step(
    "where the browser refuses the page its clipboard, Edit > Paste dims and says the key still pastes",
    await until(() => said.first().isVisible(), 8_000),
    await said
      .first()
      .innerText()
      .catch(() => ""),
  );
  await a.evaluate(() => {
    delete navigator.clipboard.read;
    delete navigator.clipboard.readText;
  });
  await a.keyboard.press("Escape");
  await note.click();
  await a.keyboard.press("ControlOrMeta+v");
  step(
    "and the key still pastes there",
    await until(async () => (await saved())?.text.includes(`after${id}`), 8_000),
    (await saved())?.text,
  );
}

async function podcastsNotice(a) {
  const FEED = "https://feeds.npr.org/510318/podcast.xml";
  await openFromDock(a, "Podcasts", "Podcasts");
  await chooseMenu(a, "File", "Add a Show by URL…");
  const adding = a.getByRole("dialog").filter({ hasText: "Add a Show by URL" });
  await adding.getByRole("textbox", { name: "Feed address" }).fill(FEED);
  await adding.getByRole("button", { name: "Add" }).click();
  await adding.waitFor({ state: "hidden", timeout: 30_000 });
  const LIBRARY_AT = "/api/podcasts/library";
  await until(
    async () => ((await api(a, "GET", LIBRARY_AT)).json?.library?.shows ?? []).length > 0,
    30_000,
  );
  await a.waitForTimeout(1_000);
  const { json } = await api(a, "GET", LIBRARY_AT);
  const title = json.library.shows[0]?.title;
  const put = await api(a, "PUT", LIBRARY_AT, {
    library: {
      ...json.library,
      shows: json.library.shows.map((show) => ({
        ...show,
        seen: Date.now() - 14 * 24 * 3600 * 1000,
      })),
    },
    rev: json.rev,
    session: json.session,
  });
  step(`${title}, followed, was last looked at two weeks ago`, put.status === 200, `${put.status}`);
  const told = await within(30_000, async () => {
    const watch = await api(a, "GET", "/api/podcasts/watch");
    return watch.status === 200 && watch.json.delivered > 0;
  });
  step("NPR's real feed gives new episodes, and the server tells of them", told !== null);
  const banner = a.locator(".mac-desktop-shell-banners > *").filter({ hasText: "New Episode" });
  const shown = await within(25_000, async () => (await banner.count()) > 0);
  step("a banner says so", shown !== null);
  await shot(a, "batch12-podcasts-banner");
  const body = banner.first().getByText("New Episode").first();
  const box = await body.boundingBox();
  await a.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const window = a.getByRole("region", { name: "Podcasts", exact: true }).first();
  step(
    "pressing it opens Podcasts on the show",
    await until(
      async () =>
        (await window.isVisible()) &&
        (await window.getByRole("heading", { name: title }).first().isVisible()),
      20_000,
    ),
  );
  await shot(a, "batch12-podcasts-show");
}

const ffprobe = (file) =>
  JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], {
      encoding: "utf8",
    }),
  );
function ffmpegReads(file) {
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
/** The colour in the middle of the picture at `seconds`, by ffmpeg. */
function colourAt(file, seconds) {
  const raw = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    file,
    "-ss",
    String(seconds),
    "-frames:v",
    "1",
    "-vf",
    "crop=4:4,scale=1:1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgb24",
    "-",
  ]);
  return [...raw];
}
const reddish = ([r, g, b]) => r > 150 && g < 80 && b < 80;
const bluish = ([r, g, b]) => b > 150 && r < 80 && g < 80;

async function quicktime(a) {
  await install(a, ["quicktime-player"]);
  await spotlight(a, "QuickTime Player");
  const qt = a.locator('.mac-managed-window[data-window-id="quicktime-player"]').first();
  await qt.waitFor({ state: "visible", timeout: 15_000 });
  await a.waitForTimeout(600);

  // Options > Timer.
  const chooseFive = async () => {
    await qt.getByRole("button", { name: "Recording Options", exact: true }).click();
    await a.getByRole("menuitemradio", { name: "5 Seconds", exact: true }).click();
    await a.waitForTimeout(200);
  };
  await chooseMenu(a, "File", "New Screen Recording");
  await chooseFive();
  const movies = async () =>
    ((await drive(a)).entries ?? []).filter((each) => /Screen Recording/.test(each.name)).length;
  const held = await movies();
  await qt.getByRole("button", { name: "Start Recording", exact: true }).click();
  const left = qt.getByLabel("Recording starts in");
  step(
    "Timer 5 Seconds counts down after the picker",
    await until(async () => Number((await left.innerText()).trim()) >= 3, 10_000),
    await left.innerText().catch(() => ""),
  );
  await qt.getByRole("button", { name: "Cancel Countdown" }).click();
  await a.waitForTimeout(6_000);
  step(
    "Cancel Countdown takes it back: nothing starts and nothing is saved",
    (await left.count()) === 0 &&
      (await qt.getByRole("button", { name: "Start Recording", exact: true }).count()) === 1 &&
      (await movies()) === held,
  );
  await qt.getByRole("button", { name: "Recording Options", exact: true }).click();
  await a.getByRole("menuitemcheckbox", { name: "Show Mouse Clicks", exact: true }).click();
  await a.waitForTimeout(200);
  await qt.getByRole("button", { name: "Start Recording", exact: true }).click();
  const began = Date.now();
  await left.waitFor({ timeout: 10_000 });
  const stop = qt.getByRole("button", { name: "Stop Recording", exact: true });
  await stop.waitFor({ timeout: 15_000 });
  const waited = (Date.now() - began) / 1000;
  step(
    "left to run, the recording begins when the five seconds are up",
    waited >= 4 && waited < 8,
    `${waited.toFixed(1)} s`,
  );
  await a.mouse.move(12, 400);
  await a.mouse.down();
  const ring = await a
    .locator(".mac-quicktime-player-click-ring")
    .evaluate((each) => [each.style.left, each.style.top].join(" "))
    .catch(() => null);
  await a.mouse.up();
  step(
    "Show Mouse Clicks rings a press on the page during the take",
    ring === "12px 400px",
    `${ring}`,
  );
  await a.waitForTimeout(1_500);
  await stop.click();
  step(
    "and goes into Movies when stopped",
    await until(async () => (await movies()) === held + 1, 20_000),
  );
  const video = qt.locator("video.mac-quicktime-player-video");
  await until(() => video.evaluate((each) => each.videoWidth > 0), 20_000);
  await qt
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();
  await a.waitForTimeout(800);

  // Export: a movie that is red for three seconds and then blue, with a tone.
  const source = path.join(out, `Colours ${id}.webm`);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=red:s=1280x720:r=30:d=3[a];color=blue:s=1280x720:r=30:d=3[b];[a][b]concat=n=2:v=1:a=0",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=6",
    "-c:v",
    "libvpx",
    "-b:v",
    "1M",
    "-c:a",
    "libopus",
    "-shortest",
    source,
  ]);
  await spotlight(a, "QuickTime Player");
  await qt.waitFor({ state: "visible", timeout: 15_000 });
  const chooser = a.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await chooser).setFiles(source);
  await until(() => video.evaluate((each) => each.videoWidth === 1280));
  await a.waitForTimeout(500);
  const encoders = await a.evaluate(
    async () =>
      (
        await VideoEncoder.isConfigSupported({
          codec: "vp09.00.51.08",
          width: 854,
          height: 480,
        })
      ).supported === true,
  );
  step("this Chromium has a VP9 encoder through WebCodecs", encoders);
  const exportStarted = Date.now();
  await chooseMenu(a, "File", "Export As", "480p");
  const exported = new RegExp(`Colours ${id}.*480p.*\\.webm`);
  await until(async () => Boolean(await liveFile(a, (each) => exported.test(each.name))), 120_000);
  const took = (Date.now() - exportStarted) / 1000;
  const entry = await liveFile(a, (each) => exported.test(each.name));
  step(
    "Export As > 480p puts a WebM in Movies",
    Boolean(entry),
    `${entry?.name} in ${took.toFixed(1)} s`,
  );
  const file = path.join(out, `exported-${id}.webm`);
  writeFileSync(file, await fileBytes(a, entry));
  const probe = ffprobe(file);
  const picture = probe.streams.find((each) => each.codec_type === "video");
  const sound = probe.streams.find((each) => each.codec_type === "audio");
  step(
    "ffprobe reads VP9 at 854 by 480 and Opus, and the file knows its length: six seconds",
    picture?.codec_name === "vp9" &&
      picture.width === 854 &&
      picture.height === 480 &&
      sound?.codec_name === "opus" &&
      Math.abs(Number(probe.format.duration) - 6) < 0.1,
    `${picture?.codec_name} ${picture?.width}x${picture?.height}, ${sound?.codec_name}, ${probe.format.duration} s, ${(probe.format.size / 1000).toFixed(0)} kB`,
  );
  const decoded = ffmpegReads(file);
  step(
    "ffmpeg decodes it whole with no complaint, and the sound is there",
    decoded.errors.length === 0 && decoded.mean > -40,
    `${decoded.errors.join("; ")} mean ${decoded.mean} dB`,
  );
  const late = colourAt(file, 2.9);
  const early = colourAt(file, 3.04);
  step(
    "the colour changes at its exact place: red at 2.9 s, blue at 3.04 s",
    reddish(late) && bluish(early),
    `${late} then ${early}`,
  );

  // The file opened again: seeks at once, and a Rotate saved into it reads back.
  await qt
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();
  await a.waitForTimeout(800);
  await spotlight(a, "QuickTime Player");
  await qt.waitFor({ state: "visible", timeout: 15_000 });
  const choose = a.waitForEvent("filechooser");
  await qt.getByRole("button", { name: "From This Computer…", exact: true }).click();
  await (await choose).setFiles(file);
  step(
    "the browser knows the exported movie's length as soon as it opens",
    await until(() =>
      video.evaluate((each) => Number.isFinite(each.duration) && Math.abs(each.duration - 6) < 0.1),
    ),
    String(await video.evaluate((each) => each.duration)),
  );
  await until(() => video.evaluate((each) => each.videoWidth === 854));
  await a.waitForTimeout(500);
  await chooseMenu(a, "Edit", "Rotate Left");
  const turned = await until(
    () => video.evaluate((each) => each.videoWidth === 480 && each.videoHeight === 854),
    90_000,
  );
  step("Edit > Rotate Left turns the movie", turned);
  const name = `exported-${id}.webm`;
  await chooseMenu(a, "File", "Save");
  const saved = await until(async () => {
    const each = await liveFile(a, (e) => e.name === name);
    if (!each) return false;
    const bytes = await fileBytes(a, each);
    const held = path.join(out, `rotated-${id}.webm`);
    writeFileSync(held, bytes);
    const read = ffprobe(held).streams.find((s) => s.codec_type === "video");
    return read?.width === 480 && read?.height === 854;
  }, 30_000);
  step("File > Save writes the turned movie, 480 by 854 by ffprobe", saved);
  await shot(a, "batch12-quicktime-rotated");
}

async function mailFindKey(a) {
  await openFromDock(a, "Mail", undefined).catch(() => {});
  await viewer(a).waitFor({ timeout: 15_000 });
  const subject = `Find key ${id}`;
  const long = Array.from({ length: 200 }, (_, line) =>
    line === 190 ? "The needle and a heron are here" : `Line ${line} of the text`,
  ).join("\n");
  await send(a, chris.name, subject, long);
  await within(20_000, async () => {
    await a.keyboard.press("Control+Shift+N");
    return (await row(a, subject).count()) > 0;
  });
  await row(a, subject).first().click();
  const content = viewer(a).locator(".mac-mail-message-content");
  await content
    .getByText(/The needle/)
    .first()
    .waitFor({ timeout: 15_000 });
  await chooseMenu(a, "Edit", "Find", "Find…");
  const field = viewer(a).getByRole("searchbox", { name: "Find in Message" });
  await field.waitFor({ timeout: 8_000 });

  const select = (words) =>
    content
      .getByText(/The needle/)
      .first()
      .evaluate((node, wanted) => {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode(); text; text = walker.nextNode()) {
          const at = text.nodeValue.indexOf(wanted);
          if (at < 0) continue;
          const range = document.createRange();
          range.setStart(text, at);
          range.setEnd(text, at + wanted.length);
          const selection = document.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          return;
        }
      }, words);
  let late = 0;
  let never = 0;
  let lost = 0;
  const ROUNDS = 30;
  for (let round = 0; round < ROUNDS; round += 1) {
    const words = round % 2 ? "heron" : "needle";
    await select(words);
    if ((await a.evaluate(() => document.getSelection().toString())) !== words) lost += 1;
    await a.keyboard.press("Control+E");
    const atOnce = await field.inputValue();
    if (atOnce !== words) {
      late += 1;
      if (!(await until(async () => (await field.inputValue()) === words, 8_000))) never += 1;
    }
  }
  step(
    `Use Selection for Find by its key takes the words every time of ${ROUNDS}`,
    never === 0,
    `not yet there when the key returned: ${late}; never: ${never}; selection gone before the key: ${lost}`,
  );
}

await run(
  {
    chromium: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  {},
  async ({ person }) => {
    allow(/HTTP 404: \S*\/api\/podcasts\/feed/);
    const b = await person("martin", martin);
    const a = await person("chris", chris);
    await trackMedia(a.context());
    await a.reload({ waitUntil: "load" });
    await a
      .getByRole("button", { name: /^Finder$/ })
      .first()
      .waitFor({ timeout: 30_000 });
    const parts = {
      voice: () => voiceAndShares(a, b),
      siri: () => siriPlays(a),
      script: () => scriptKept(a),
      stickies: () => stickiesPaste(a),
      podcasts: () => podcastsNotice(a),
      quicktime: () => quicktime(a),
      find: () => mailFindKey(a),
    };
    for (const [name, part] of Object.entries(parts)) {
      if (!only.includes(name)) continue;
      console.log(`--- ${name}`);
      try {
        await part();
      } catch (error) {
        step(`${name} ran to its end`, false, String(error).split("\n")[0]);
        await shot(a, `batch12-${name}-stopped`);
      }
      await reloadDesktop(a);
      await pause(500);
    }
  },
);

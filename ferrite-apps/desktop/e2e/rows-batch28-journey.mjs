#!/usr/bin/env node
// The rows of batch 28, against `ferrite dev`, one group per item of the batch:
// help-viewer.md Real pictures; siri.md Siri pane and Dictation pane; calendar.md Invitee picker; music.md row 99 Genius.
//
// Stand-ins: a headless browser has no microphone and Chromium on Linux has no voices, so a stub replaces speechSynthesis and
// the browser's speech recognition. Each stub only records what the desktop asks for (the utterance's lang, the recognizer's
// lang). Nothing was heard or spoken: this proves what the desktop asks a browser for, not the browser's own voice or hearing.
//
//   node e2e/rows-batch28-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>] [--only help,siri,dictation,calendar,music]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { createAccount, person } from "./r2-census-kit.mjs";

const { base, out } = options();
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt > 0 ? process.argv[onlyAt + 1].split(",") : null;
const wanted = (group) => !only || only.includes(group);

const { step, run } = journey("rows-batch28", { ignoreOtherOrigins: true });

const STUBS = () => {
  window.spokenIn = [];
  window.heardIn = [];
  const voices = ["en-US", "en-GB", "de-DE"].map((lang) => ({ lang, name: lang }));
  const target = new EventTarget();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => voices,
      cancel: () => {},
      speak: (words) => window.spokenIn.push(words.lang),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    },
  });
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.lang = "";
    }
  };
  class Recognizer {
    start() {
      window.heardIn.push(this.lang);
      window.heard = this;
    }
    stop() {
      this.onend?.();
    }
    addEventListener() {}
  }
  window.SpeechRecognition = Recognizer;
  window.webkitSpeechRecognition = Recognizer;
};

const dock = (page, name) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name, exact: true });

async function open(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await page.waitForTimeout(500);
  await field.press("Enter");
}
const windowOf = (page, id) => page.locator(`.mac-managed-window[data-window-id="${id}"]`).first();
const closeFront = async (page) => {
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+w");
  await page.waitForTimeout(400);
};
const SETTINGS = "/api/system-preferences/settings";
const values = async (page) => (await api(page, "GET", SETTINGS)).json.values ?? {};
const keptValue = (page, key, wantedValue) =>
  until(async () => (await values(page))[key] === wantedValue, 15_000);

async function help(page) {
  await open(page, "Help Viewer");
  const viewer = windowOf(page, "help-viewer");
  await viewer.waitFor({ timeout: 20_000 });
  const loaded = (locator) =>
    locator.evaluate((image) => image.complete && image.naturalWidth > 0 && image.currentSrc);

  await viewer.getByRole("combobox", { name: "Book" }).click();
  await page.getByRole("option", { name: "Notes Help", exact: true }).click();
  const notes = viewer.getByRole("img", { name: /^Notes on this desktop/ });
  await notes.waitFor({ timeout: 10_000 });
  await until(() => loaded(notes), 10_000);
  const onBook = await loaded(notes);
  step(
    "Help: Notes' book shows a picture of Notes, its bytes loaded",
    /\.webp/.test(onBook),
    onBook,
  );
  await viewer.locator('article a[data-help-link="guide:notes:1"]').click();
  await viewer.getByRole("heading", { name: "Write a note" }).waitFor({ timeout: 10_000 });
  await until(() => loaded(notes), 10_000);
  const src = await loaded(notes);
  step("Help: and so does its first topic", /\.webp/.test(src), src);
  await shot(page, path.join(out, "help-notes-picture.png"));
  await closeFront(page);
}

async function siriPane(page) {
  await dock(page, "System Preferences").click();
  const prefs = windowOf(page, "system-preferences");
  await prefs.waitFor({ timeout: 15_000 });
  await prefs.getByRole("button", { name: "Siri", exact: true }).click();
  const choose = async (label, name) => {
    await prefs.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name, exact: true }).click();
  };
  const voiceBox = prefs.getByRole("combobox", { name: "Siri Voice:" });
  await voiceBox.click();
  await page.getByRole("option").first().waitFor({ timeout: 5_000 });
  const offered = await page.getByRole("option").allInnerTexts();
  step(
    "Siri pane: the voices are the accents the browser has voices for",
    offered.join() === "American,British",
    offered.join(),
  );
  await page.getByRole("option", { name: "British", exact: true }).click();
  step(
    "Siri pane: the voice is kept on the server",
    await keptValue(page, "siri.voice", "British"),
  );

  const speakToSiri = async (words) => {
    await page.getByRole("menuitem", { name: "Siri", exact: true }).click();
    await page.getByRole("button", { name: "Listen", exact: true }).click();
    await page.waitForTimeout(300);
    await page.evaluate((said) => {
      window.heard.onresult({
        results: [Object.assign([{ transcript: said }], { isFinal: true })],
      });
      window.heard.onend?.();
    }, words);
    await until(() => page.evaluate(() => window.spokenIn.length > 0), 5_000);
    await page.waitForTimeout(1_000);
    const listened = await page.evaluate(() => window.heardIn.at(-1));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    return listened;
  };
  await speakToSiri("what time is it");
  const british = await page.evaluate(() => window.spokenIn.at(-1));
  step("Siri asks the browser for a voice of that accent", british === "en-GB", british);

  await choose("Language:", "German (Germany)");
  step(
    "Siri pane: the language is kept on the server",
    await keptValue(page, "siri.language", "German (Germany)"),
  );
  step(
    "Siri pane: it says its answers stay in English",
    await prefs.getByText("It understands requests and writes its answers in English.").isVisible(),
  );
  step(
    "Siri pane: a voice of German needs no accent, so the voice is dimmed",
    await voiceBox.isDisabled(),
  );
  await shot(page, path.join(out, "siri-pane-german.png"));
  const listening = await speakToSiri("what time is it");
  const german = await page.evaluate(() => window.spokenIn.at(-1));
  step("Siri speaks in German", german === "de-DE", german);
  step("Siri asks the recognizer for German", listening === "de-DE", listening);
  await choose("Language:", "English (United States)");
  step(
    "Siri pane: the shortcut can be chosen, saying a page never sees Fn",
    /Fn key/.test(
      (await prefs.getByRole("combobox", { name: "Keyboard Shortcut:" }).getAttribute("title")) ??
        "",
    ),
  );
  await closeFront(page);
}

async function dictation(page) {
  await dock(page, "System Preferences").click();
  const prefs = windowOf(page, "system-preferences");
  await prefs.waitFor({ timeout: 15_000 });
  const showAll = prefs.getByRole("button", { name: "Show All" });
  if (await showAll.isEnabled()) await showAll.click();
  await prefs.getByRole("button", { name: "Keyboard", exact: true }).click();
  await prefs.getByRole("tab", { name: "Dictation" }).click();
  const offOn = prefs.getByRole("radio", { name: "Off" });
  step(
    "Dictation pane: a new person's Dictation is off, and Language is dimmed",
    (await offOn.getAttribute("aria-checked")) === "true" &&
      (await prefs.getByRole("combobox", { name: "Language:" }).isDisabled()),
  );
  const offer = page.getByRole("alertdialog");
  await prefs.getByRole("radio", { name: "On" }).click();
  step(
    "Dictation pane: On asks first, and Cancel leaves it off",
    /Do you want to enable Dictation\?/.test(await offer.innerText()),
  );
  await offer.getByRole("button", { name: "Cancel" }).click();
  await offer.waitFor({ state: "detached" });
  step(
    "Dictation pane: after Cancel Off is still chosen and nothing is kept",
    (await offOn.getAttribute("aria-checked")) === "true" &&
      (await values(page))["dictation.on"] === undefined,
  );
  await shot(page, path.join(out, "dictation-pane-off.png"));
  await closeFront(page);

  await open(page, "TextEdit");
  const editor = windowOf(page, "textedit");
  await editor.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
  const text = editor.locator('[contenteditable="true"]').first();
  await text.click();
  await chooseMenu(page, "Edit", "Start Dictation…");
  await offer.waitFor({ timeout: 5_000 });
  step(
    "With Dictation off, Start Dictation offers to enable it, with Cancel and Enable Dictation",
    /Do you want to enable Dictation\?/.test(await offer.innerText()) &&
      (await offer.getByRole("button", { name: "Cancel" }).isVisible()) &&
      (await offer.getByRole("button", { name: "Enable Dictation" }).isVisible()) &&
      (await page.evaluate(() => window.heardIn.length)) === 0,
  );
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "dictation-offer.png"));
  await offer.getByRole("button", { name: "Cancel" }).click();
  await offer.waitFor({ state: "detached" });
  await until(() => text.evaluate((node) => document.activeElement === node), 3_000);
  step(
    "Cancel: nothing listens, Dictation stays off, the text keeps the keyboard",
    (await page.evaluate(() => window.heardIn.length)) === 0 &&
      (await values(page))["dictation.on"] === undefined &&
      (await text.evaluate((node) => document.activeElement === node)),
  );
  await chooseMenu(page, "Edit", "Start Dictation…");
  await offer.getByRole("button", { name: "Enable Dictation" }).click();
  step("Enable Dictation is kept on the server", await keptValue(page, "dictation.on", true));
  const panel = page.getByRole("dialog", { name: "Dictation" });
  await panel.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(500);
  step(
    "and dictation starts in the text, which has the keyboard",
    (await page.evaluate(() => window.heardIn.length)) === 1 &&
      (await panel.isVisible()) &&
      (await text.evaluate((node) => document.activeElement === node)),
  );
  await panel.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(500);
  await closeFront(page);

  await dock(page, "System Preferences").click();
  step(
    "Dictation pane: enabled from the menu, On shows chosen",
    await until(
      async () =>
        (await prefs.getByRole("radio", { name: "On" }).getAttribute("aria-checked")) === "true",
      5_000,
    ),
  );
  await prefs.getByRole("combobox", { name: "Language:" }).click();
  await page.getByRole("option", { name: "French (France)", exact: true }).click();
  step(
    "Dictation pane: the language is kept on the server",
    await keptValue(page, "dictation.language", "French (France)"),
  );
  await shot(page, path.join(out, "dictation-pane.png"));
  await closeFront(page);

  await open(page, "TextEdit");
  await editor.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
  await text.click();
  await chooseMenu(page, "Edit", "Start Dictation…");
  await until(() => page.evaluate(() => window.heardIn.at(-1) === "fr-FR"), 5_000);
  const lang = await page.evaluate(() => window.heardIn.at(-1));
  step("Start Dictation asks the recognizer for French", lang === "fr-FR", lang);
  await page
    .getByRole("dialog", { name: "Dictation" })
    .getByRole("button", { name: "Done" })
    .click();
  await page.waitForTimeout(500);

  await dock(page, "System Preferences").click();
  await prefs.getByRole("radio", { name: "Off" }).click();
  step("Dictation pane: Off is kept on the server", await keptValue(page, "dictation.on", false));
  await prefs.getByRole("radio", { name: "On" }).click();
  await offer.getByRole("button", { name: "Enable Dictation" }).click();
  step(
    "Dictation pane: Enable Dictation chooses On at once and keeps it",
    (await until(
      async () =>
        (await prefs.getByRole("radio", { name: "On" }).getAttribute("aria-checked")) === "true",
      5_000,
    )) && (await keptValue(page, "dictation.on", true)),
  );
  await prefs.getByRole("radio", { name: "Off" }).click();
  await keptValue(page, "dictation.on", false);
  await closeFront(page);
  await open(page, "TextEdit");
  await page.waitForTimeout(800);
  await text.click();
  await chooseMenu(page, "Edit", "Start Dictation…");
  await offer.waitFor({ timeout: 5_000 });
  step("Turned off again in the pane, Start Dictation asks again", await offer.isVisible());
  await page.keyboard.press("Escape");
  await offer.waitFor({ state: "detached" });
  await closeFront(page);
}

async function calendar(page) {
  const tag = Date.now().toString(36);
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  const other = await context.newPage();
  const invited = person(tag, "inv", "Invited Person");
  await createAccount(other, base, invited);
  await context.close();
  const organizing = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 900 } });
  const organizer = await organizing.newPage();
  await createAccount(organizer, base, person(tag, "org", "Organizing Person"));
  await dock(organizer, "Calendar").click();
  const win = windowOf(organizer, "calendar");
  await win.waitFor({ timeout: 15_000 });
  await organizer.waitForTimeout(1_000);
  await organizer.keyboard.press("Control+n");
  const block = win.locator("[data-event-id]").first();
  await block.waitFor({ timeout: 15_000 });
  const addInvitees = organizer.getByRole("button", { name: "Add Invitees" });
  if (!(await addInvitees.isVisible())) await block.dblclick();
  await addInvitees.click({ timeout: 15_000 });
  const field = organizer.getByRole("textbox", { name: "Invitee" });
  await field.fill("pat@example.com");
  await field.press("Enter");
  const alert = organizer.getByRole("alert").filter({ hasText: "pat@example.com" });
  await alert.waitFor({ timeout: 5_000 });
  step(
    "Calendar: an outside address says why it cannot be invited, naming itself",
    /“pat@example\.com” cannot be invited: invitations go between this desktop's accounts/.test(
      await alert.innerText(),
    ),
  );
  await shot(organizer, path.join(out, "calendar-outside-address.png"));
  await field.fill(`${invited.name}@macalicious`);
  await field.press("Enter");
  const listed = organizer.getByRole("list", { name: "Invitees" }).getByText(invited.fullName);
  await listed.waitFor({ timeout: 10_000 });
  step("Calendar: an address of this desktop's own mail invites its account", true);
  await organizing.close();
}

async function music(page) {
  await dock(page, "Music").click();
  const win = windowOf(page, "music");
  await win.waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
  const song = (id, title, artist, genre) => ({
    id,
    title,
    artist,
    album: `${artist} album`,
    genre,
    year: 2020,
    track: 1,
    duration: 60,
    added: Date.now(),
    artwork: null,
    source: { kind: "stream", url: `https://example.org/${id}.mp3` },
  });
  const held = (await api(page, "GET", "/api/music/library")).json;
  const songs = [
    song("g-seed", "Seed Song", "Low Sun", "Folk"),
    song("g-artist", "Same Artist", "Low Sun", "Rock"),
    song("g-genre", "Same Genre", "Other", "Folk"),
    song("g-far", "Far Away", "Elsewhere", "Jazz"),
  ];
  const put = await api(page, "PUT", "/api/music/library", {
    library: { songs, playlists: [], loved: [] },
    rev: held.rev,
  });
  step("Music: four songs in the library", put.status === 200, String(put.status));
  await reloadDesktop(page);
  await dock(page, "Music").click();
  await win.waitFor({ timeout: 15_000 });
  await win.getByText("Songs", { exact: true }).first().click();
  await page.waitForTimeout(800);

  await page.getByRole("menubar").getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "New", exact: true }).hover();
  const dimmedRow = page.getByRole("menuitem", { name: "Genius Playlist" });
  await dimmedRow.waitFor({ timeout: 5_000 });
  step(
    "Genius Playlist is dimmed with no song, and says what it needs",
    (await dimmedRow.getAttribute("aria-disabled")) === "true" &&
      /Select a song/.test((await dimmedRow.getAttribute("title")) ?? ""),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await win.getByText("Seed Song", { exact: true }).first().click();
  await page.getByRole("menubar").getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "New", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Genius Playlist" }).click();
  const note = win.getByRole("note").filter({ hasText: "Apple's Genius service" });
  await note.waitFor({ timeout: 10_000 });
  step(
    "The playlist says it was made here, from what",
    /Made on this desktop from the artist and genre of “Seed Song” and your own library/.test(
      await note.innerText(),
    ),
  );
  const read = async () => {
    const { library } = (await api(page, "GET", "/api/music/library")).json;
    return library?.playlists?.find((list) => list.name === "Genius: Seed Song");
  };
  await until(async () => Boolean(await read()), 15_000);
  const made = await read();
  step(
    "The server holds it: the song, its artist, its genre, and not the far one",
    made?.songs.join() === "g-seed,g-artist,g-genre",
    made?.songs.join(),
  );
  await shot(page, path.join(out, "music-genius.png"));

  await reloadDesktop(page);
  await dock(page, "Music").click();
  await win.waitFor({ timeout: 15_000 });
  await win.getByText("Genius: Seed Song", { exact: true }).first().click();
  await note.waitFor({ timeout: 10_000 });
  step("After a reload it is still marked as made here", true);
  await win.getByRole("button", { name: "Refresh" }).click();
  await page.waitForTimeout(800);
  const refreshed = await read();
  step(
    "Refresh makes the same list from the same library",
    refreshed?.songs.join() === made?.songs.join(),
  );
  await win.getByRole("combobox", { name: "Limit Genius playlist" }).click();
  await page.getByRole("option", { name: "50 songs", exact: true }).click();
  const keptLimit = await until(async () => {
    const values = (await api(page, "GET", "/api/system-preferences/settings")).json?.values;
    const list = Object.values(values?.["music.genius"] ?? {})[0];
    return list?.size === 50 ? list : null;
  }, 8_000);
  step("The limit pop-up's choice is kept on the server", Boolean(keptLimit), keptLimit?.seed);
  await closeFront(page);
}

await run(async (page) => {
  await page.addInitScript(STUBS);
  await openDesktop(page, base, step);
  for (const [group, body] of [
    ["help", help],
    ["siri", siriPane],
    ["dictation", dictation],
    ["calendar", calendar],
    ["music", music],
  ]) {
    if (!wanted(group)) continue;
    try {
      await body(page);
    } catch (error) {
      step(`${group}: the group ran to its end`, false, String(error).split("\n")[0]);
    }
  }
});

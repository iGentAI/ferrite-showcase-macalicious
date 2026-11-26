#!/usr/bin/env node
// Edit > Start Dictation in TextEdit, Notes and a plain input, with the floating panel, Done and Escape; dimmed with its reason
// when no field has the keyboard or the browser has no recognizer. Then Spotlight: a drive file above Search the Web, and Return
// on a reminder, a mail message, a photo album, a font and a song; a drive file dragged into Music's window.
//
// Stand-in: a headless browser has no microphone, so a stub replaces the browser's speech recognition, and the journey hands it
// the words. Nothing was really heard: this proves what the desktop does with words a recognizer reports, not recognition.
//
//   node e2e/dictation-batch5-journey.mjs [--url http://127.0.0.1:8787] [--out dir]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";
import { uploadFile } from "./system-kit.mjs";

const { base, out } = options();
const { step, run } = journey("dictation-batch5", { ignoreOtherOrigins: true });
const tag = Date.now().toString(36);
const WORD = `Mirabel${tag}`;
const ME = `dict${tag}`;

const menuBar = (page, title) =>
  page.getByRole("menubar").getByRole("menuitem", { name: title, exact: true });

const dictationRow = (page) =>
  page.locator('[role="menu"]').getByRole("menuitem", { name: /^(Start|Stop) Dictation/ });

async function openEdit(page) {
  await menuBar(page, "Edit").click();
  await dictationRow(page).waitFor({ timeout: 5_000 });
}

const say = (page, words, isFinal = true) =>
  page.evaluate(([words, isFinal]) => window.dictationStub.say(words, isFinal), [words, isFinal]);

async function until(page, read, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    const value = await read();
    if (value) return value;
    await page.waitForTimeout(250);
  }
  return null;
}

let enabled = false;

async function startFromMenu(page) {
  await openEdit(page);
  await dictationRow(page).click();
  if (!enabled) {
    await page.getByRole("alertdialog").getByRole("button", { name: "Enable Dictation" }).click();
    enabled = true;
  }
  const panel = page.getByRole("dialog", { name: "Dictation" });
  await panel.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  return panel;
}

/** A short mono WAV naming its song in a RIFF INFO list, as `music-depth-journey.mjs` writes one. */
function wav(title) {
  const rate = 8_000;
  const pcm = Buffer.alloc(rate * 2 * 4);
  for (let i = 0; i < pcm.length / 2; i += 1)
    pcm.writeInt16LE(Math.round(Math.sin(i / 3) * 2000), i * 2);
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
  const info = Buffer.concat([Buffer.from("INFO"), chunk("INAM", Buffer.from(`${title}\0`))]);
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

/** A point of `frame` that is really on top there, so a drag lands in that window behind another. */
const visiblePointOf = (frame) =>
  frame.evaluate((element) => {
    const box = element.getBoundingClientRect();
    for (let y = box.bottom - 12; y > box.top + 40; y -= 24) {
      for (let x = box.left + 12; x < box.right - 12; x += 24) {
        if (element.contains(document.elementFromPoint(x, y))) return { x, y };
      }
    }
    return null;
  });

async function spotlightReturn(page, typed, option) {
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  const found = page.getByRole("option", { name: option }).first();
  for (let i = 0; i < 20 && !(await found.isVisible()); i += 1) {
    await field.fill("");
    await field.fill(typed);
    await page.waitForTimeout(500);
  }
  await found.click();
  await field.press("Enter").catch(() => {});
  await page.waitForFunction(
    () => !document.querySelector('[role="combobox"][aria-label="Spotlight Search"]'),
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(800);
}

await run(async (page) => {
  page.setDefaultTimeout(15_000);
  await page.addInitScript(() => {
    const stub = { live: null, stops: 0, langs: [], results: [] };
    stub.say = (words, isFinal) => {
      const result = Object.assign([{ transcript: words }], { isFinal });
      stub.results = stub.results.filter((each) => each.isFinal);
      stub.results.push(result);
      stub.live?.onresult?.({ results: stub.results });
    };
    stub.refuse = () => {
      stub.live?.onerror?.({ error: "not-allowed" });
      stub.live?.onend?.();
    };
    stub.end = () => stub.live?.onend?.();
    window.dictationStub = stub;
    window.SpeechRecognition = class {
      start() {
        stub.live = this;
        stub.results = [];
        stub.langs.push(this.lang);
      }
      stop() {
        stub.stops += 1;
      }
    };
  });
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: ME,
    fullName: "Dictation Batch",
    password: randomBytes(12).toString("base64url"),
  });
  await page.reload();
  await openDesktop(page, base, step);

  // TextEdit: rich text.
  await launch(page, "TextEdit");
  const editor = page
    .locator(
      "[data-window-id^='textedit'] [contenteditable='true'], [data-window-id^='textedit'] textarea",
    )
    .first();
  await editor.waitFor({ timeout: 15_000 });
  await editor.click();
  await page.keyboard.type("Dear team.");
  const words = () => editor.innerText().catch(() => editor.inputValue());

  const typed = await words();
  const panel = await startFromMenu(page);
  step("Start Dictation in TextEdit shows the panel, listening", await panel.isVisible());
  step(
    "the panel says it listens, with Done",
    (await panel.getByRole("status").innerText()) === "Listening…" &&
      (await panel.getByRole("button", { name: "Done" }).isVisible()),
  );
  await say(page, "good", false);
  step(
    "words still changing show in the panel and not in the text",
    (await panel.getByRole("status").innerText()) === "good" && (await words()) === typed,
    await words(),
  );
  await shot(page, path.join(out, "dictation-panel.png"));
  await say(page, "good morning");
  step(
    "finished words go in at the insertion point, as a new sentence",
    (await words()) === `${typed} Good morning`,
    await words(),
  );
  step(
    "the editor keeps the keyboard",
    await editor.evaluate((element) => document.activeElement === element),
  );
  await say(page, "to you");
  step(
    "more follows with a space",
    (await words()) === `${typed} Good morning to you`,
    await words(),
  );
  await openEdit(page);
  step(
    "Edit's row says Stop Dictation while it listens",
    (await dictationRow(page).innerText()).trim() === "Stop Dictation",
  );
  await say(page, "while the menu is open");
  await page.keyboard.press("Escape");
  step(
    "Escape closes the menu, not dictation",
    (await until(
      page,
      async () => (await page.locator('[role="menu"][data-open]').count()) === 0,
    )) && (await panel.isVisible()),
  );
  const held = await until(page, async () =>
    (await words()).endsWith("to you while the menu is open"),
  );
  step(
    "words heard behind the menu arrive when the field has the keyboard back",
    held,
    await words(),
  );
  await panel.getByRole("button", { name: "Done" }).click();
  step(
    "Done stops the recognizer and the field keeps the keyboard",
    (await page.evaluate(() => window.dictationStub.stops)) === 1 &&
      (await editor.evaluate((element) => document.activeElement === element)),
  );
  await say(page, "last words");
  step(
    "what was said before Done still arrives",
    (await words()).endsWith("open last words"),
    await words(),
  );
  await page.evaluate(() => window.dictationStub.end());
  await panel.waitFor({ state: "detached", timeout: 5_000 });
  step("and the panel goes when the recognizer ends", true);
  await say(page, "nobody asked");
  step("nothing is typed after it ended", !(await words()).includes("nobody asked"));

  // Notes: kept on the server, across a reload; Escape.
  await launch(page, "Notes");
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("listbox", { name: "Notes" }).waitFor({ timeout: 15_000 });
  await menuBar(page, "File").click();
  await page.locator('[role="menu"]').getByRole("menuitem", { name: "New Note" }).first().click();
  await page.waitForTimeout(500);
  await page.keyboard.type(`${WORD} `);
  const notePanel = await startFromMenu(page);
  await say(page, "typed by dictation");
  await say(page, "dropped", false);
  await page.keyboard.press("Escape");
  await notePanel.waitFor({ state: "detached", timeout: 5_000 });
  step("Escape ends dictation at once", true);
  const noteText = async () =>
    ((await api(page, "GET", "/api/notes/data")).json.data.notes ?? [])
      .find((note) => note.lines?.[0]?.startsWith(WORD))
      ?.lines?.join("\n");
  const kept = await until(page, async () => (await noteText())?.includes("typed by dictation"));
  step(
    "the note holds the words on the server, without what was still changing",
    kept && !(await noteText()).includes("dropped"),
    await noteText(),
  );
  await reloadDesktop(page, base);
  step("and after a reload", (await noteText())?.includes("typed by dictation"), await noteText());

  // A plain text input, the microphone refused.
  await launch(page, "Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 15_000 });
  const search = finder.getByRole("searchbox").first();
  await search.click();
  const inputPanel = await startFromMenu(page);
  await say(page, "budget");
  step(
    "a plain input takes dictation",
    (await search.inputValue()) === "Budget",
    await search.inputValue(),
  );
  await page.evaluate(() => window.dictationStub.refuse());
  step(
    "a refused microphone is said in the panel",
    /can’t hear you/.test(await inputPanel.getByRole("status").innerText()),
  );
  await inputPanel.getByRole("button", { name: "Done" }).click();
  await inputPanel.waitFor({ state: "detached", timeout: 5_000 });
  await search.fill("");

  // No field.
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  await page.waitForTimeout(200);
  await openEdit(page);
  const row = dictationRow(page);
  step(
    "with no field the row is dimmed and says why",
    (await row.getAttribute("aria-disabled")) === "true" &&
      /text field/.test((await row.getAttribute("data-reason")) ?? ""),
    await row.getAttribute("data-reason"),
  );
  await page.keyboard.press("Escape");

  // No recognizer.
  await page.addInitScript(() => {
    delete window.webkitSpeechRecognition;
    delete window.SpeechRecognition;
  });
  await reloadDesktop(page, base);
  await launch(page, "Finder");
  await finder.waitFor({ timeout: 15_000 });
  await finder.getByRole("searchbox").first().click();
  await openEdit(page);
  step(
    "a browser without a recognizer dims the row with the reason",
    (await dictationRow(page).getAttribute("aria-disabled")) === "true" &&
      /speech service/.test((await dictationRow(page).getAttribute("data-reason")) ?? ""),
    await dictationRow(page).getAttribute("data-reason"),
  );
  await page.keyboard.press("Escape");

  // Spotlight ranks a drive file above Search the Web, and Return opens it.
  const fileName = `${WORD} plans.txt`;
  await uploadFile(page, {
    parent: "documents",
    name: fileName,
    type: "text/plain",
    text: "plan\n",
  });
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  const spot = page.getByRole("combobox", { name: "Spotlight Search" });
  const fileRow = page.getByRole("option", { name: new RegExp(fileName) }).first();
  for (let i = 0; i < 20 && !(await fileRow.isVisible()); i += 1) {
    await spot.fill("");
    await spot.fill(`${WORD} plans`);
    await page.waitForTimeout(500);
  }
  const order = await page.getByRole("option").allInnerTexts();
  const fileAt = order.findIndex((text) => text.includes(fileName));
  const webAt = order.findIndex((text) => text.includes("Search the Web"));
  step(
    "Spotlight lists a drive file above Search the Web",
    fileAt >= 0 && webAt > fileAt,
    `file ${fileAt}, web ${webAt}`,
  );
  await shot(page, path.join(out, "spotlight-file-above-web.png"));
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Return on results of the apps not yet driven from Spotlight.
  const reminder = `${WORD} reminder`;
  const asked = await api(page, "POST", "/api/siri/ask", {
    text: `Remind me to ${reminder}`,
    tz: 0,
  });
  if (asked.status !== 200) throw new Error(`a reminder: HTTP ${asked.status}`);
  // The page reads the person's reminders once; a change made through the API needs a new page.
  await reloadDesktop(page);
  await spotlightReturn(page, reminder, new RegExp(reminder));
  const remindersWindow = page.locator('[data-window-id^="reminders"]').first();
  await remindersWindow.waitFor({ timeout: 15_000 });
  step(
    "Return on a reminder selects it in Reminders",
    await until(page, () =>
      remindersWindow.evaluate(
        (element, title) =>
          element.textContent.includes(title) ||
          [...element.querySelectorAll("input, textarea")].some((each) =>
            each.value.includes(title),
          ),
        reminder,
      ),
    ),
  );

  const subject = `${WORD} message`;
  const sent = await api(page, "POST", "/api/mail/send", {
    to: [ME],
    cc: [],
    subject,
    text: "Sent to oneself.",
  });
  if (sent.status < 300) {
    await spotlightReturn(page, subject, new RegExp(subject));
    const mail = page.locator('[data-window-id^="mail"]').first();
    await mail.waitFor({ timeout: 15_000 });
    step(
      "Return on a mail message opens it in Mail",
      await until(page, async () => (await mail.getByText("Sent to oneself.").count()) > 0),
    );
  } else {
    step("Return on a mail message opens it in Mail", false, `send answered ${sent.status}`);
  }

  const album = `${WORD} album`;
  await api(page, "POST", "/api/photos/albums", { id: `a-${tag}`, name: album });
  await spotlightReturn(page, album, new RegExp(album));
  const photos = page.locator('[data-window-id^="photos"]').first();
  await photos.waitFor({ timeout: 15_000 });
  step(
    "Return on a photo album shows it in Photos",
    await until(page, async () => (await photos.getByText(album).count()) > 0),
  );

  await spotlightReturn(page, "Helvetica", /Helvetica/);
  const fontBook = page.locator('[data-window-id^="font-book"]').first();
  await fontBook.waitFor({ timeout: 15_000 });
  step(
    "Return on a font shows it in Font Book",
    await until(page, async () => (await fontBook.getByText(/Helvetica/).count()) > 0),
  );

  // Music: a drive file dragged into its window.
  const song = `${WORD} Song`;
  const wavName = `${WORD}.wav`;
  await uploadFile(page, {
    parent: "documents",
    name: wavName,
    type: "audio/wav",
    bytes: wav(song),
  });
  await reloadDesktop(page);
  await launch(page, "Music");
  const music = page.locator(".mac-window.mac-music").first();
  await music.waitFor({ timeout: 15_000 });
  await until(page, async () => (await music.getAttribute("aria-busy")) !== "true");
  await launch(page, "Finder");
  await finder.waitFor({ timeout: 15_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const songFile = finder.getByRole("option", { name: wavName, exact: true }).first();
  await songFile.waitFor({ timeout: 15_000 });
  const from = await songFile.boundingBox();
  const to = await visiblePointOf(music);
  step("Music's window shows behind Finder's", to !== null);
  const libraryHas = async () =>
    ((await api(page, "GET", "/api/music/library")).json.library?.songs ?? []).some(
      (each) => each.title === song,
    );
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  step(
    "Music's window takes the drag",
    (await music.getAttribute("data-desktop-drop")) === "accept",
    String(await music.getAttribute("data-desktop-drop")),
  );
  await page.mouse.up();
  step("the song joins the library on the server", await until(page, libraryHas));
  await reloadDesktop(page, base);
  step("and is there after a reload", await libraryHas());

  await spotlightReturn(page, song, new RegExp(song));
  const musicAgain = page.locator(".mac-window.mac-music").first();
  await musicAgain.waitFor({ timeout: 15_000 });
  step(
    "Return on a song shows it in Music",
    await until(page, async () => (await musicAgain.getByText(song).count()) > 0),
  );
  await shot(page, path.join(out, "dictation-batch5-music.png"));
});

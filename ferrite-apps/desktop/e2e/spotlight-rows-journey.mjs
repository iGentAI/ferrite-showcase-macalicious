#!/usr/bin/env node
// Spotlight's own kinds of result, one by one, on an account of its own: a word that only this journey
// wrote, in a contact, a message, an event, a reminder, a note, a sticky, a TextEdit document, a bookmark,
// a song and a photo album, each listed in its own group and saying which application opens it. A second
// account finds none of them.
//
//   node e2e/spotlight-rows-journey.mjs [--url http://127.0.0.1:8787] [--out dir] [--browser chromium]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { api, journey, options, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("spotlight-rows");
const tag = Date.now().toString(36);
const WORD = `Quillon${tag}`;
const me = `srows${tag}`;

const put = async (page, url, body) => {
  const reply = await api(page, "PUT", url, body);
  if (reply.status >= 300) throw new Error(`${url}: HTTP ${reply.status}`);
};
const rev = async (page, url) => (await api(page, "GET", url)).json.rev;

await run(async (page) => {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, {
    name: me,
    fullName: "Spotlight Rows",
    password: randomBytes(12).toString("base64url"),
  });
  const now = Date.now();
  await put(page, "/api/contacts/cards", {
    cards: [{ id: "c1", account: "icloud", first: WORD, last: "Contact" }],
    rev: await rev(page, "/api/contacts/cards"),
  });
  await api(page, "POST", "/api/mail/send", {
    to: [me],
    cc: [],
    subject: `${WORD} message`,
    text: "Sent to oneself.",
  });
  await put(page, "/api/calendar/events", {
    events: [
      {
        id: "e1",
        title: `${WORD} event`,
        start: now + 3_600_000,
        end: now + 7_200_000,
        calendar: "work",
      },
    ],
    rev: await rev(page, "/api/calendar/events"),
  });
  await put(page, "/api/reminders/data", {
    base: await rev(page, "/api/reminders/data"),
    data: {
      lists: [{ id: "l1", name: "Reminders", color: "blue" }],
      reminders: [{ id: "r1", listId: "l1", title: `${WORD} reminder` }],
    },
    alerts: {},
  });
  const noted = await api(page, "POST", "/api/siri/ask", {
    text: `Make a note that says ${WORD} note`,
    tz: 0,
  });
  if (noted.status !== 200) throw new Error(`a note: HTTP ${noted.status}`);
  await put(page, "/api/stickies/data", {
    base: await rev(page, "/api/stickies/data"),
    data: { notes: [{ id: "s1", color: "yellow", text: `${WORD} sticky` }] },
  });
  await put(page, "/api/textedit/files", {
    files: [
      {
        place: "Documents",
        folders: [],
        file: {
          id: "d1",
          kind: "document",
          name: `${WORD} document.rtf`,
          document: {
            name: `${WORD} document.rtf`,
            format: "plain",
            lines: ["Words in the document"],
          },
        },
      },
    ],
    rev: await rev(page, "/api/textedit/files"),
  });
  await put(page, "/api/safari/bookmarks", {
    favorites: [{ title: `${WORD} bookmark`, url: "https://example.com/" }],
    bookmarks: [],
    rev: await rev(page, "/api/safari/bookmarks"),
  });
  await put(page, "/api/music/library", {
    library: {
      songs: [
        {
          id: "m1",
          title: `${WORD} song`,
          artist: "Nobody",
          album: "Nothing",
          duration: 60,
          added: now,
          source: { kind: "file", file: "none", name: "song.mp3", type: "audio/mpeg", size: 1 },
        },
      ],
      playlists: [],
      loved: [],
    },
    rev: await rev(page, "/api/music/library"),
  });
  await api(page, "POST", "/api/photos/albums", { id: `a-${tag}`, name: `${WORD} album` });

  await page.reload();
  await page.getByRole("menubar").first().waitFor({ timeout: 30_000 });
  await page
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(WORD);
  const inGroup = (group, name) =>
    page
      .getByRole("group", { name: new RegExp(`^(?:${group}|Top Hit)$`) })
      .getByRole("option", { name })
      .first();
  await inGroup("Contacts", WORD).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await shot(page, path.join(out, `spotlight-rows-all-${browserName}.png`));
  for (const [group, name, opens, shows] of [
    ["Contacts", `${WORD} Contact`, "Contacts"],
    ["Mail Messages", `${WORD} message`, "Mail"],
    ["Events", `${WORD} event`, "Calendar"],
    ["Reminders", `${WORD} reminder`, "Reminders"],
    ["Notes", `${WORD} note`, "Notes"],
    ["Stickies", `${WORD} sticky`, "Stickies"],
    ["Documents", `${WORD} document`, "TextEdit", ["Words in the document"]],
    ["Bookmarks & History", `${WORD} bookmark`, "Safari"],
    ["Music", `${WORD} song`, "Music", ["Nobody", "Nothing"]],
    ["Photos", `${WORD} album`, "Photos"],
  ]) {
    const option = inGroup(group, name);
    const listed = (await option.count()) === 1;
    step(`${group} lists what was written`, listed, name);
    if (!listed) continue;
    await option.click();
    await page.waitForTimeout(150);
    const preview = await page.getByRole("group", { name: "Preview" }).innerText();
    step(`and says ${opens} opens it`, preview.includes(`Opens in ${opens}`), preview.slice(0, 80));
    if (shows) {
      step(
        `and its preview shows ${shows.join(" and ")}`,
        shows.every((words) => preview.includes(words)),
        preview.slice(0, 80),
      );
    }
    if (group === "Documents") {
      await shot(page, path.join(out, `spotlight-rows-document-${browserName}.png`));
    }
  }
  await inGroup("Music", `${WORD} song`).click();
  await shot(page, path.join(out, `spotlight-rows-music-${browserName}.png`));
  step(
    "Search the Web is offered for the words",
    (await page.getByRole("group", { name: "Search the Web" }).count()) === 1,
  );
  await page.keyboard.press("Escape");

  const stranger = await page.context().browser().newContext();
  const other = await stranger.newPage();
  await other.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(other, {
    name: `sother${tag}`,
    fullName: "Someone Else",
    password: randomBytes(12).toString("base64url"),
  });
  await other
    .getByRole("button", { name: /^Finder$/ })
    .first()
    .waitFor({ timeout: 30_000 });
  await other.waitForTimeout(600);
  await other.getByRole("menuitem", { name: "Spotlight", exact: true }).first().click();
  const theirField = other.getByRole("combobox", { name: "Spotlight Search" });
  await theirField.fill(WORD);
  await other.getByRole("group", { name: "Search the Web" }).waitFor({ timeout: 15_000 });
  await other.waitForTimeout(1_500);
  await shot(other, path.join(out, `spotlight-rows-stranger-${browserName}.png`));
  const theirOptions = await other.getByRole("option").allInnerTexts();
  const mine = /Contact|message|event|reminder|note|sticky|document|bookmark|song|album/;
  step(
    "Another account's Spotlight lists none of it",
    !theirOptions.some((text) => text.includes(WORD) && mine.test(text)) && theirOptions.length > 0,
    theirOptions.join(" | ").slice(0, 120),
  );
  const found = await api(other, "GET", `/api/spotlight/search?q=${encodeURIComponent(WORD)}`);
  step(
    "and the server returns none of it",
    found.status === 200 && (found.json.results ?? []).length === 0,
    `${(found.json.results ?? []).length} results`,
  );
  await stranger.close();
});

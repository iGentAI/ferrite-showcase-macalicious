#!/usr/bin/env node
// Shared links into Messages and Notes (gap round MAC-3.1). Share > Notes and Share > Messages in
// Safari, News and Stocks hand the link to the app (`demos/desktop/desktop-share-link.tsx`):
//
// - Share > Notes makes a new note, titled, with the link's address, saved on the server;
// - Share > Messages opens a new message with the link in its field; the journey addresses it to
//   another account (the friend) and sends it into their conversation, kept on the server;
// - after a reload, Notes still lists the three notes and the conversation holds the three links;
// - a third account (the stranger) has none of the notes and no conversation of theirs.
//
// Every person is a new account made at the login window, so the journey changes nobody's data.
// Mail and Reminders take links in their own sessions' bundles (WS7, WS5). Exits 0 only when every
// step passed and the desktop logged no console error, page error, failed request or HTTP error.
//
//   ferrite dev --egress allow                       # in ferrite-apps/desktop
//   node e2e/share-links-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                    [--browser chromium|chrome|firefox|webkit]

import { randomBytes } from "node:crypto";
import path from "node:path";
import { api, journey, launch, options, reloadDesktop, shot } from "./app-journey.mjs";
import { createAccount } from "./people-kit.mjs";

const { base, out, browserName } = options();
const { step, run } = journey("share-links", { ignoreOtherOrigins: true });
const CATALINA = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const AAPL = "https://www.cnbc.com/quotes/AAPL";
const tag = `${browserName.slice(0, 2)}${Date.now().toString(36)}`;
const person = (label, fullName) => ({
  name: `ws2${label}${tag}`,
  fullName,
  password: randomBytes(12).toString("base64url"),
});
const sharer = person("s", "WS2 Sharer");
const friend = person("f", "WS2 Friend");
const stranger = person("x", "WS2 Stranger");

const region = (page, name) => page.getByRole("region", { name, exact: true }).first();
/** Text with each run of whitespace (line breaks included) as one space. */
const normal = (text) => text.replace(/\s+/g, " ").trim();
/** The notes a stored notes document holds: every object in it with `lines`. */
const notesIn = (value, found = []) => {
  if (Array.isArray(value)) for (const item of value) notesIn(item, found);
  else if (value && typeof value === "object") {
    if (Array.isArray(value.lines)) found.push(value);
    else for (const item of Object.values(value)) notesIn(item, found);
  }
  return found;
};
const messagesWindow = (page) => region(page, "Messages");

/** A new account, made at the login window. */
async function newPerson(page, who) {
  await page.goto(`${base}/`, { waitUntil: "load" });
  await createAccount(page, who);
}

/** Open (or bring forward) an app through Spotlight, as the News and Stocks journeys do. */
async function spotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
  const window = region(page, name);
  await window.waitFor({ state: "visible", timeout: 15_000 });
  return window;
}

/** Wait until `field`'s value holds `text`; its value then. */
async function valueHolding(field, text, ms = 10_000) {
  let value = "";
  for (let waited = 0; waited <= ms; waited += 200) {
    value = await field.inputValue().catch(() => "");
    if (value.includes(text)) break;
    await field.page().waitForTimeout(200);
  }
  return value;
}

/** Close a window with its close button. It must be gone within 10 s, or the run stops there:
 * the next share then opens the app from closed, as the journey means it to. */
async function closeWindow(window) {
  await window
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
}

/** The next response that passes `accept`, or `null` after `ms`: never a rejection that would
 * end the run before the step that waits for it can fail. */
const nextResponse = (page, accept, ms = 20_000) =>
  page.waitForResponse(accept, { timeout: ms }).catch(() => null);

/**
 * From `source` (its Share button pressed by `openShare`, its window brought forward by `front`):
 * Share > Notes makes a new note of the link, saved; then Share > Messages starts a new message
 * holding it, which is sent to the friend.
 */
async function shareInto(page, source, { front, openShare, url, title }) {
  const saved = nextResponse(
    page,
    (r) =>
      new URL(r.url()).pathname === "/api/notes/data" &&
      r.request().method() !== "GET" &&
      (r.request().postData() ?? "").includes(url),
  );
  await openShare();
  await page.getByRole("menuitem", { name: "Notes", exact: true }).first().click();
  const notes = region(page, "Notes");
  await notes.waitFor({ state: "visible", timeout: 15_000 });
  const first = notes.getByRole("listbox", { name: "Notes" }).getByRole("option").first();
  await first.waitFor({ timeout: 10_000 });
  const savedStatus = (await saved)?.status();
  const firstText = (await first.innerText()).replace(/\s+/g, " ");
  // The note itself: the link's title as its first line, then its address. Notes' row shows a
  // long title's start and its remainder as the snippet (`summarize`, notes-data.ts), so the row is
  // checked for the title's start only.
  const note = notesIn((await api(page, "GET", "/api/notes/data")).json).find((each) =>
    each.lines.includes(url),
  );
  step(
    `${source}: Share > Notes makes a new note of the link, its title then its address, and saves it`,
    savedStatus === 200 &&
      (note?.lines[0] ?? "").startsWith(normal(title)) &&
      firstText.startsWith(normal(title).slice(0, 20)),
    `${JSON.stringify(note?.lines)}; row ${firstText.slice(0, 80)}`,
  );
  // Closed again: the next share opens it from closed, and it takes the link it was kept.
  await closeWindow(notes);

  await front();
  const sent = nextResponse(
    page,
    (r) =>
      new URL(r.url()).pathname.startsWith("/api/messages/") &&
      r.request().method() === "POST" &&
      (r.request().postData() ?? "").includes(url),
  );
  await openShare();
  await page.getByRole("menuitem", { name: "Messages", exact: true }).first().click();
  const messages = messagesWindow(page);
  await messages.waitFor({ state: "visible", timeout: 15_000 });
  const field = messages.getByRole("textbox", { name: "Message" });
  const drafted = await valueHolding(field, url);
  const to = messages.getByRole("textbox", { name: "To" });
  step(
    `${source}: Share > Messages opens a new message holding the link, waiting for a recipient`,
    drafted.includes(url) &&
      normal(drafted).includes(normal(title)) &&
      (await to.inputValue()) === "",
    drafted,
  );
  await to.fill(friend.name);
  await to.press("Enter");
  await field.press("Enter");
  const sentStatus = (await sent)?.status() ?? 0;
  step(
    `${source}: addressed to the friend, the message with the link is sent`,
    sentStatus >= 200 && sentStatus < 300,
    `HTTP ${sentStatus}`,
  );
  await closeWindow(messages);
}

await run(async (page) => {
  // The friend exists first, so the sharer can address messages to them.
  const friendContext = await page.context().browser().newContext();
  try {
    await newPerson(await friendContext.newPage(), friend);
  } finally {
    await friendContext.close();
  }
  await newPerson(page, sharer);
  step("the sharer and the friend are new accounts", true, `${sharer.name}, ${friend.name}`);
  // Stocks does not come with the desktop: get it from the App Store first.
  const library = await api(page, "GET", "/api/app-store/library");
  await api(page, "PUT", "/api/app-store/library", {
    installed: [...new Set([...(library.json?.installed ?? []), "stocks"])],
    rev: library.json?.rev ?? 0,
  });
  await reloadDesktop(page);

  // ── From Safari: a listed page ──
  await launch(page, "Safari");
  const safari = region(page, "Safari");
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  const address = safari.getByRole("textbox", { name: "Search or enter website name" });
  await address.click();
  await address.fill(CATALINA);
  await address.press("Enter");
  await safari.locator('iframe[title="macOS Catalina - Wikipedia"]').waitFor({ timeout: 20_000 });
  await shareInto(page, "Safari", {
    front: async () => {
      await launch(page, "Safari");
      await safari.waitFor({ state: "visible", timeout: 10_000 });
    },
    openShare: () => safari.getByRole("button", { name: "Share" }).click(),
    url: CATALINA,
    title: "macOS Catalina - Wikipedia",
  });
  await shot(page, path.join(out, `share-messages-safari-${browserName}.png`));
  // Each source closes once it has shared, so no window of it covers the next app.
  await closeWindow(safari);

  // ── From News: a story, opened ──
  let news = await spotlight(page, "News");
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await news.elementHandle(),
    {
      timeout: 20_000,
    },
  );
  const story = news.locator(".mac-news-story-link").first();
  await story.waitFor({ state: "visible", timeout: 30_000 });
  // The visit News keeps when the story opens: its title and link are what is shared.
  const visited = nextResponse(
    page,
    (r) =>
      r.request().method() === "PUT" &&
      new URL(r.url()).pathname === "/api/news/library" &&
      Boolean(JSON.parse(r.request().postData() ?? "null")?.library?.history?.[0]?.link),
  );
  await shot(page, path.join(out, `share-news-before-${browserName}.png`));
  await story.click();
  // The story view's own heading, in whatever form the live headline takes there.
  await news
    .locator('[data-view="reader"] h2')
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
  const opened = JSON.parse((await visited)?.request().postData() ?? "null")?.library?.history?.[0];
  const storyLink = opened?.link;
  const headline = normal(opened?.title ?? "");
  step(
    "News: the story opens, and its title and link are known from History",
    Boolean(storyLink) && headline !== "",
    `${headline} — ${storyLink}`,
  );
  if (!storyLink) throw new Error("no story link: News kept no visit");
  await shareInto(page, "News", {
    front: async () => {
      news = await spotlight(page, "News");
    },
    openShare: () => news.getByRole("button", { name: "Share" }).click(),
    url: new URL(storyLink).href,
    title: headline,
  });
  await closeWindow(news);

  // ── From Stocks: a symbol, opened ──
  let stocks = await spotlight(page, "Stocks");
  await stocks
    .getByRole("button", { name: /^AAPL\b/ })
    .first()
    .click();
  await stocks.getByText("P/E").first().waitFor({ timeout: 15_000 });
  await shareInto(page, "Stocks", {
    front: async () => {
      stocks = await spotlight(page, "Stocks");
    },
    openShare: () => stocks.getByRole("button", { name: "Share" }).click(),
    url: AAPL,
    title: "AAPL",
  });
  await closeWindow(stocks);

  // ── After a reload: kept on the server for the sharer ──
  const links = [CATALINA, new URL(storyLink).href, AAPL];
  await reloadDesktop(page);
  const keptNotes = notesIn((await api(page, "GET", "/api/notes/data")).json);
  const notes = await spotlight(page, "Notes");
  const listed = (await notes.getByRole("listbox", { name: "Notes" }).innerText()).replace(
    /\s+/g,
    " ",
  );
  const titles = ["macOS Catalina - Wikipedia", headline, "AAPL"];
  step(
    "after a reload the three notes are kept, each its title then its address, and Notes lists them",
    links.every((link, at) =>
      keptNotes.some(
        (each) => each.lines.includes(link) && (each.lines[0] ?? "").startsWith(titles[at]),
      ),
    ) && titles.every((title) => listed.includes(title.slice(0, 20))),
  );
  await shot(page, path.join(out, `share-notes-${browserName}.png`));
  const conversations = (await api(page, "GET", "/api/messages/conversations")).json?.conversations;
  const withFriend = (conversations ?? []).filter((conversation) =>
    (conversation.members ?? []).some((member) => member.name === friend.name),
  );
  let held = "";
  for (const conversation of withFriend) {
    const read = await api(
      page,
      "GET",
      `/api/messages/conversations/${encodeURIComponent(conversation.id)}`,
    );
    held += JSON.stringify(read.json ?? {});
  }
  step(
    "after a reload the conversation with the friend holds the three links",
    withFriend.length > 0 && links.every((link) => held.includes(link)),
    `${withFriend.length} conversation(s)`,
  );

  // ── Another account sees none of it ──
  const strangerContext = await page.context().browser().newContext();
  try {
    const other = await strangerContext.newPage();
    await newPerson(other, stranger);
    const theirNotes = JSON.stringify((await api(other, "GET", "/api/notes/data")).json ?? {});
    const theirs = (await api(other, "GET", "/api/messages/conversations")).json?.conversations;
    step(
      "a third account has none of the notes and no conversation with the sharer",
      !links.some((link) => theirNotes.includes(link)) &&
        Array.isArray(theirs) &&
        !theirs.some((conversation) =>
          (conversation.members ?? []).some((member) => member.name === sharer.name),
        ),
      `${theirs?.length} conversation(s)`,
    );
  } finally {
    await strangerContext.close();
  }
});

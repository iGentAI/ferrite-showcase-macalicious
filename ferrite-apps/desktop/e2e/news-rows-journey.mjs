#!/usr/bin/env node
// News's rows of the inventory that had no picture of their own: every view and its list, the
// Discover and channel pages, a topic, search, the toolbar, what a failed feed says, Suggested For
// You, Find in Story, sharing to Mail, Messages, Notes and Reminders, the kept library and its
// limits, and the feed the server keeps. Feeds are real, read from the publishers by the server; the
// failed feed is a Playwright route.
//
//   node e2e/news-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import {
  api,
  clipboardText,
  journey,
  launch,
  openDesktop,
  options,
  reloadDesktop,
  shot,
} from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const LIBRARY = "/api/news/library";
const { base, out, browserName } = options();
const { step, run, expectRefusal } = journey("news-rows", {
  ignoreOtherOrigins: true,
  contextOptions: { chromium: { permissions: ["clipboard-read", "clipboard-write"] } },
});

const settled = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};
const stored = async (page) => (await api(page, "GET", LIBRARY)).json.library ?? {};
const windowOf = (page) => page.getByRole("region", { name: "News", exact: true }).first();
const menuItem = (page, name) => page.getByRole("menuitem", { name, exact: true });

/** Waits for what the page is reading to end, so a reload aborts none of it. */
function requestsUnderWay(page) {
  const open = new Set();
  page.on("request", (request) => {
    if (!/^\/(live|__forge)\//.test(new URL(request.url()).pathname)) open.add(request);
  });
  for (const end of ["requestfinished", "requestfailed"])
    page.on(end, (request) => open.delete(request));
  return () => until(async () => open.size === 0, 30_000);
}

async function openNews(page) {
  await launch(page, "News");
  const window = windowOf(page);
  await window.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 30_000 },
  );
  return window;
}

await run(async (page) => {
  const quiet = requestsUnderWay(page);
  await openDesktop(page, base, step);
  let window = await openNews(page);
  const sidebar = window.getByRole("navigation", { name: "Channels" });
  const row = (name) => sidebar.getByRole("button", { name, exact: true });
  const links = window.locator(".mac-news-story-link");
  const reader = window.locator('[data-view="reader"]');
  const heading = (name) => window.getByRole("heading", { level: 2, name, exact: true });

  // ---- News > Preferences… ----------------------------------------------------------------------
  const prefs = await menuItemState(page, "News", "Preferences…");
  step(
    "News > Preferences… is dimmed, saying why",
    prefs.disabled && /no preferences/.test(prefs.title ?? ""),
    prefs.title,
  );
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "News", exact: true })
    .click();
  await menuItem(page, "Preferences…").waitFor({ timeout: 5_000 });
  await settled(page, "news-rows-app-menu.png");
  await closeMenus(page);

  // ---- Today, with Suggested For You --------------------------------------------------------------
  await links.nth(4).waitFor({ timeout: 40_000 });
  const top = window.getByRole("region", { name: "Top Stories", exact: true });
  step(
    "Today has the masthead and the leads of the channels followed",
    (await window.locator(".mac-news-masthead").isVisible()) &&
      (await top.locator(".mac-news-story-link").count()) === 2,
    (await window.locator(".mac-news-masthead").innerText()).replace(/\s+/g, " "),
  );
  await settled(page, "news-rows-today.png");
  const suggested = window.getByRole("region", { name: "Suggested For You" });
  const suggestedLinks = suggested.locator(".mac-news-story-link");
  await suggestedLinks
    .first()
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  // What the person's channels publish, from the server: none of it may be suggested.
  const catalogue = (await api(page, "GET", "/api/news/catalogue")).json;
  const held = await stored(page);
  const ownFeeds = await Promise.all(
    [...(held.following ?? catalogue.following), ...(held.blocked ?? [])].map(async (id) => {
      const { status, json } = await api(page, "GET", `/api/news/sources/${id}`);
      if (status !== 200 || !Array.isArray(json?.stories)) {
        throw new Error(`channel ${id} could not be read (${status}): nothing can be said of it`);
      }
      return json.stories;
    }),
  );
  const ownStories = ownFeeds.flat();
  const ownTitles = new Set(ownStories.map((story) => story.title));
  const ownPublishers = new Set(ownStories.map((story) => story.publisher));
  const suggestedTitles = (await suggestedLinks.allInnerTexts()).map((title) => title.trim());
  const suggestedPublishers = await suggested.locator(".mac-news-story-publisher").allInnerTexts();
  step(
    "Suggested For You lists stories, none from a channel followed or blocked",
    ownStories.length > 0 &&
      suggestedTitles.length > 0 &&
      suggestedTitles.every((title) => !ownTitles.has(title)) &&
      suggestedPublishers.every((publisher) => !ownPublishers.has(publisher.trim())),
    `${suggestedPublishers.join(", ")} against ${[...ownPublishers].join(", ")}`,
  );
  await suggestedLinks.first().scrollIntoViewIfNeeded();
  await settled(page, "news-rows-suggested.png");

  // ---- Top Stories, Discover, a channel's page -----------------------------------------------------
  await window.getByRole("button", { name: /^More\s+Top Stories/ }).click();
  await heading("Top Stories").waitFor({ timeout: 10_000 });
  const topCount = await links.count();
  step(
    "More Top Stories lists all the stories of the channels followed",
    topCount > 5,
    `${topCount}`,
  );
  await settled(page, "news-rows-top-stories.png");

  await row("Discover Channels").click();
  await heading("Discover Channels").waitFor({ timeout: 10_000 });
  const discoverRows = window.locator(".mac-news-discover-row");
  step(
    "Discover lists channels with Follow and Block",
    (await discoverRows.count()) > 4 &&
      (await window.getByRole("button", { name: "Follow NASA" }).isVisible()),
    `${await discoverRows.count()} channels`,
  );
  await settled(page, "news-rows-discover.png");

  await window.getByRole("button", { name: "NASA", exact: true }).click();
  await heading("NASA").waitFor({ timeout: 10_000 });
  await links.first().waitFor({ timeout: 30_000 });
  await window.getByRole("button", { name: "Follow", exact: true }).click();
  step(
    "a channel page's Follow follows it on the server, and it joins the sidebar",
    (await until(async () => (await stored(page)).following?.includes("nasa"), 15_000)) &&
      (await row("NASA").isVisible()),
  );
  await settled(page, "news-rows-channel.png");
  await window.getByRole("button", { name: "Block Channel", exact: true }).click();
  step(
    "its Block blocks it on the server, ends the following and empties the page",
    (await until(async () => {
      const now = await stored(page);
      return now.blocked?.includes("nasa") && !now.following?.includes("nasa");
    }, 15_000)) && (await window.getByText("You blocked this channel.").isVisible()),
  );
  step(
    "a blocked channel's Follow is dimmed",
    await window.getByRole("button", { name: "Follow", exact: true }).isDisabled(),
  );
  await settled(page, "news-rows-blocked.png");
  const channels = await stored(page);

  // ---- Topics -------------------------------------------------------------------------------------
  step("there are ten topics", catalogue.topics?.length === 10, `${catalogue.topics?.length}`);
  const topicRows = await Promise.all(catalogue.topics.map((topic) => row(topic.name).isVisible()));
  step("the sidebar lists them all", topicRows.every(Boolean));
  await row("Science").click();
  await heading("Science").waitFor({ timeout: 10_000 });
  await links.first().waitFor({ timeout: 30_000 });
  step(
    "a topic page merges its channels' stories",
    (await links.count()) > 0,
    `${await links.count()}`,
  );
  await settled(page, "news-rows-topic.png");

  // ---- Search: only feeds already read ---------------------------------------------------------------
  const searchField = window.getByRole("searchbox").first();
  const sought =
    (await links.first().textContent())?.trim().split(/\s+/).slice(0, 3).join(" ") ?? "";
  await searchField.fill(sought);
  await heading("Search Results").waitFor({ timeout: 10_000 });
  step("search finds a story of a feed already read", (await links.count()) > 0, sought);
  await settled(page, "news-rows-search.png");
  await searchField.fill("zzqqxx nothing like it");
  step(
    "a search that finds nothing says so",
    await window
      .getByText("No Results")
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await searchField.fill("");

  // ---- Sidebar toggle and toolbar Back ---------------------------------------------------------------
  await window.getByRole("button", { name: "Hide Sidebar" }).click();
  await sidebar.waitFor({ state: "detached", timeout: 5_000 });
  step("the toolbar's button hides the sidebar", true);
  await settled(page, "news-rows-sidebar-hidden.png");
  await window.getByRole("button", { name: "Show Sidebar" }).click();
  await sidebar.waitFor({ state: "visible", timeout: 5_000 });
  step("and shows it", true);

  await chooseMenu(page, "View", "Go to Today");
  await links.nth(4).waitFor({ timeout: 30_000 });
  const backButton = window.getByRole("button", { name: "Back", exact: true });
  step("the toolbar's Back is dimmed with no story open", await backButton.isDisabled());

  // ---- Read Full Story, Find in Story, Share ---------------------------------------------------------
  const lead = (await links.first().textContent())?.trim() ?? "";
  await links.first().click();
  await reader.waitFor({ timeout: 10_000 });
  await settled(page, "news-rows-reader.png");
  const dimmedToday = await backButton.isEnabled();
  step("with a story open the toolbar's Back is enabled", dimmedToday);

  // ---- Find in Story. Off a Mac, Control-Option-F is the window manager's full-screen key, so the
  // journey drives the menu row and Option-Command-F itself is not pressed here.
  const find = window.getByRole("searchbox", { name: "Find in Story" });
  await chooseMenu(page, "Edit", "Find in Story");
  await find.waitFor({ timeout: 5_000 });
  step(
    "Edit > Find in Story shows the find bar with the keyboard in it",
    await until(() => find.evaluate((field) => field === document.activeElement), 3_000),
  );
  const titleWord = lead.split(/\s+/).find((word) => word.length > 3) ?? lead;
  await find.fill(titleWord.replace(/[^\p{L}\p{N}]/gu, ""));
  const count = window.locator(".mac-news-find-count");
  step(
    "it finds the word in the story and says where it stands",
    await until(async () => /^1 of \d+$/.test(await count.innerText()), 5_000),
    `${titleWord}: ${await count.innerText()}`,
  );
  await settled(page, "news-rows-find.png");
  await page.keyboard.press("Escape");
  await find.waitFor({ state: "detached", timeout: 5_000 });
  step("Escape closes it", (await window.locator(".mac-news-find-match").count()) === 0);
  await chooseMenu(page, "Edit", "Find in Story");
  await find.waitFor({ timeout: 5_000 });
  await until(() => find.evaluate((field) => field === document.activeElement), 3_000);
  await find.fill("zzqqxx");
  step(
    "after closing, it opens again, and a word not there says Not Found",
    await until(async () => (await count.innerText()) === "Not Found", 5_000),
  );
  await window.locator(".mac-news-title").first().click();
  await chooseMenu(page, "Edit", "Find in Story");
  step(
    "asked again while it shows, it takes the keyboard back and keeps what is sought",
    (await until(() => find.evaluate((field) => field === document.activeElement), 3_000)) &&
      (await find.inputValue()) === "zzqqxx",
    await find.inputValue(),
  );
  await page.keyboard.press("Escape");

  await backButton.click();
  await reader.waitFor({ state: "detached", timeout: 5_000 });
  step("the toolbar's Back goes back to the list", true);
  const noFind = await menuItemState(page, "Edit", "Find in Story");
  step("with no story open it is dimmed, saying why", noFind.disabled, noFind.title);
  await menuItemState(page, "Edit", "Search");

  // ---- Edit's rows on a real field, through the menu: the search field --------------------------
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  const value = () => searchField.inputValue();
  await searchField.fill("harbour");
  // A command runs as its menu lets go of the keyboard.
  const edit = async (row) => {
    await chooseMenu(page, "Edit", row);
    await page.waitForTimeout(450);
  };
  await edit("Select All");
  await edit("Cut");
  step(
    "Edit > Cut takes the selected text out of the field",
    (await value()) === "",
    await value(),
  );
  await edit("Paste");
  if (browserName === "webkit") {
    step(
      "Edit > Paste, refused by WebKit, says to press the key",
      await until(() => page.getByText("Press Command-V in the field").first().isVisible(), 5_000),
    );
    await searchField.focus();
    await page.keyboard.press("Control+v");
  }
  step(
    "Edit > Paste puts it back",
    await until(async () => (await value()) === "harbour", 5_000),
    await value(),
  );
  await edit("Undo");
  step("Edit > Undo takes the paste back", (await value()) === "", await value());
  await edit("Redo");
  step("Edit > Redo makes it again", (await value()) === "harbour", await value());
  await searchField.fill("");
  await window
    .locator(".mac-news-pane")
    .first()
    .click({ position: { x: 4, y: 4 } });
  const noField = await menuItemState(page, "Edit", "Paste");
  step("with no field in hand Paste is dimmed, saying why", noField.disabled, noField.title);

  // A press on what takes no keyboard leaves the field too, and Copy then has the page's selection.
  await searchField.fill("harbour");
  await edit("Select All");
  const masthead = window
    .locator(".mac-news-pane")
    .locator("h2, h3, p:not([tabindex])")
    .filter({ hasNotText: "Press Command-V" })
    .first();
  await masthead.click();
  const afterPress = await menuItemState(page, "Edit", "Paste");
  step("a press on a heading lets go of the field: Paste is dimmed", afterPress.disabled);
  const headingText = await masthead.evaluate((heading) => {
    const range = document.createRange();
    range.selectNodeContents(heading);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  });
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await chooseMenu(page, "Edit", "Copy");
  step(
    "and Edit > Copy copies the text selected on the page, not the field's",
    await until(async () => (await clipboardText(page)) === headingText, 3_000),
    headingText,
  );
  await page.evaluate(() => document.getSelection().removeAllRanges());
  await searchField.fill("");
  await window
    .locator(".mac-news-pane")
    .first()
    .click({ position: { x: 4, y: 4 } });

  // Read Full Story, on a story whose address is kept.
  await links.first().click();
  await reader.waitFor({ timeout: 10_000 });
  const opened = await until(async () => (await stored(page)).history?.[0]?.title === lead, 15_000);
  step("opening a story keeps it in History", opened);
  const link = (await stored(page)).history[0].link;
  await window.getByRole("button", { name: "Save Story" }).click();
  step(
    "the reader's Save keeps it on the server",
    await until(async () => (await stored(page)).saved?.[0]?.title === lead, 15_000),
  );

  // ---- Share: the Mail, Messages, Notes and Reminders rows, and Copy Link ---------------------------
  const share = window.getByRole("button", { name: "Share", exact: true });
  await share.click();
  await menuItem(page, "Copy Link").waitFor({ timeout: 5_000 });
  await settled(page, "news-rows-share-menu.png");
  await menuItem(page, "Copy Link").click();
  step(
    "Copy Link puts the story's address on the clipboard",
    await until(async () => (await clipboardText(page)) === new URL(link).href, 5_000),
    link,
  );

  const newsAgain = async () => {
    await page
      .getByRole("toolbar", { name: "Dock" })
      .getByRole("button", { name: "News", exact: true })
      .click();
    await page.waitForTimeout(300);
  };
  const shareTo = async (row) => {
    await share.click();
    await menuItem(page, row).click();
  };
  const host = new URL(link).host;

  await shareTo("Notes");
  const notes = page.locator('[data-window-id="notes"]').first();
  await notes.waitFor({ timeout: 20_000 });
  step(
    "Share > Notes makes a new note holding the link",
    await until(async () => (await notes.innerText()).includes(host), 15_000),
    host,
  );
  await settled(page, "news-rows-share-notes.png");
  await quiet();
  await newsAgain();

  await shareTo("Reminders");
  const reminders = page.locator('[data-window-id="reminders"]').first();
  await reminders.waitFor({ timeout: 20_000 });
  step(
    "Share > Reminders makes a reminder of it",
    await until(async () => {
      const held = await page.evaluate(() =>
        fetch("/api/reminders/data", { credentials: "same-origin" }).then((r) => r.text()),
      );
      return held.includes(host);
    }, 15_000),
  );
  await settled(page, "news-rows-share-reminders.png");
  await newsAgain();

  await shareTo("Messages");
  const messages = page.locator('[data-window-id="messages"]').first();
  await messages.waitFor({ timeout: 20_000 });
  step(
    "Share > Messages starts a new message with the link",
    await until(
      () =>
        messages.evaluate(
          (frame, wanted) =>
            frame.innerText.includes(wanted) ||
            [...frame.querySelectorAll("input, textarea")].some((field) =>
              field.value.includes(wanted),
            ),
          host,
        ),
      15_000,
    ),
  );
  await settled(page, "news-rows-share-messages.png");
  await newsAgain();

  await shareTo("Mail");
  const mail = page.getByRole("dialog").or(page.locator('[data-window-id^="mail"]')).first();
  await mail.waitFor({ timeout: 25_000 });
  step(
    "Share > Mail opens a new message with the link",
    await until(
      () =>
        page.evaluate(
          (wanted) =>
            [...document.querySelectorAll('[data-window-id^="mail"]')].some(
              (frame) =>
                frame.innerText.includes(wanted) ||
                [...frame.querySelectorAll("input, textarea")].some((field) =>
                  field.value.includes(wanted),
                ),
            ),
          host,
        ),
      15_000,
    ),
  );
  await settled(page, "news-rows-share-mail.png");

  // ---- Read Full Story opens Safari --------------------------------------------------------------
  await newsAgain();
  await window.getByRole("button", { name: "Read Full Story" }).click();
  const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
  await safari.waitFor({ state: "visible", timeout: 20_000 });
  const address = safari
    .getByRole("combobox", { name: "Search or enter website name" })
    .or(safari.getByRole("textbox", { name: "Search or enter website name" }))
    .first();
  step(
    "Read Full Story opens the story's address in Safari",
    await until(async () => (await address.inputValue()) === new URL(link).href, 15_000),
    await address.inputValue(),
  );
  await settled(page, "news-rows-safari.png");

  // ---- Saved Stories and History, Clear History ------------------------------------------------------
  await newsAgain();
  await row("Saved Stories").click();
  await heading("Saved Stories").waitFor({ timeout: 10_000 });
  step("Saved Stories lists the story", await links.filter({ hasText: lead }).first().isVisible());
  await settled(page, "news-rows-saved.png");
  await row("History").click();
  await heading("History").waitFor({ timeout: 10_000 });
  step("History lists the story", await links.filter({ hasText: lead }).first().isVisible());
  await settled(page, "news-rows-history.png");
  await window.getByRole("button", { name: "Clear History" }).click();
  step(
    "Clear History empties it on the server and in the window",
    (await until(async () => (await stored(page)).history?.length === 0, 15_000)) &&
      (await window.getByText("No History").isVisible()),
  );

  // ---- Limits: Saved at 150, History at 60 ---------------------------------------------------------
  const story = (n) => ({
    id: `seed-${n}`,
    source: "bbc",
    publisher: "BBC News",
    title: `Seed story ${n}`,
    link: `https://www.bbc.co.uk/news/seed-${n}`,
    published: Date.now() - n * 60_000,
  });
  const doc = (await api(page, "GET", LIBRARY)).json;
  const seeded = await api(page, "PUT", LIBRARY, {
    library: {
      ...doc.library,
      saved: Array.from({ length: 150 }, (_, n) => story(n)),
      history: Array.from({ length: 60 }, (_, n) => story(n)),
    },
    rev: doc.rev,
  });
  step("the server takes a full library: 150 saved, 60 in History", seeded.status === 200);
  await quiet();
  await reloadDesktop(page);
  window = await openNews(page);
  const lastRow = () => window.getByRole("navigation", { name: "Channels" });
  await lastRow().getByRole("button", { name: "Today", exact: true }).click();
  await links.first().waitFor({ timeout: 30_000 });
  await links.first().click();
  await reader.waitFor({ timeout: 10_000 });
  // Read from the story opened: Today's list can still move while the other feeds arrive.
  const newest = (await reader.getByRole("heading").first().textContent())?.trim() ?? "";
  const refused = await until(async () => {
    const now = await stored(page);
    return (
      now.saved?.length === 150 &&
      now.history?.length === 60 &&
      now.saved[0].title === "Seed story 0" &&
      now.saved.at(-1).title === "Seed story 149" &&
      now.history[0].title === newest
    );
  }, 15_000);
  const fullBefore = JSON.stringify((await stored(page)).saved.map((one) => one.id));
  await window.getByRole("button", { name: "Save Story" }).click();
  const said = window.getByText(/^Saved Stories keeps at most 150 stories/);
  await said.waitFor({ timeout: 5_000 });
  await quiet();
  await settled(page, "news-rows-saved-full.png");
  step(
    "a full Saved Stories refuses one more and says so, losing none; History takes the newest",
    refused && JSON.stringify((await stored(page)).saved.map((one) => one.id)) === fullBefore,
    `saved ${(await stored(page)).saved?.length}, history ${(await stored(page)).history?.length}`,
  );

  // ---- Followed and blocked, over a reload -------------------------------------------------------
  const nowHeld = await stored(page);
  step(
    "after a reload the server holds the channels as they were left",
    JSON.stringify(nowHeld.blocked) === JSON.stringify(channels.blocked) &&
      JSON.stringify(nowHeld.following) === JSON.stringify(channels.following),
    `blocked ${nowHeld.blocked}, following ${nowHeld.following}`,
  );
  await lastRow().getByRole("button", { name: "Saved Stories", exact: true }).click();
  await heading("Saved Stories").waitFor({ timeout: 10_000 });
  await settled(page, "news-rows-kept.png");

  // ---- The feed the server keeps --------------------------------------------------------------------
  const firstRead = await api(page, "GET", "/api/news/sources/bbc");
  const secondRead = await api(page, "GET", "/api/news/sources/bbc");
  step(
    "two reads of a feed answer the copy the server keeps, within fifteen minutes of reading it",
    firstRead.json.fetched === secondRead.json.fetched &&
      catalogue.freshMs === 900_000 &&
      Date.now() - firstRead.json.fetched < 900_000,
    `fetched ${new Date(firstRead.json.fetched).toISOString()}, stale ${firstRead.json.stale}`,
  );

  // ---- A feed that fails ----------------------------------------------------------------------------
  await chooseMenu(page, "View", "Go to Today");
  await links.first().waitFor({ timeout: 30_000 });
  await window.locator(".mac-news-status").first().waitFor();
  const failing = (url) => url.pathname === "/api/news/sources/npr";
  for (let refusal = 0; refusal < 3; refusal += 1) expectRefusal(502, "/api/news/sources/npr");
  await page.route(failing, (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "the publisher did not answer" }),
    }),
  );
  await chooseMenu(page, "View", "Reload");
  const status = window.locator(".mac-news-status").first();
  step(
    "a feed that cannot be read says so, and the others' stories stay",
    (await until(async () => /Could not refresh NPR/.test(await status.innerText()), 15_000)) &&
      (await links.count()) > 0,
    await status.innerText(),
  );
  await settled(page, "news-rows-feed-failed.png");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await chooseMenu(page, "View", "Reload");
  step(
    "the next good read clears it",
    await until(async () => !/Could not refresh/.test(await status.innerText()), 15_000),
    await status.innerText(),
  );
  await quiet();
});

process.exit(0);

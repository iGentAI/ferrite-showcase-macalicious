#!/usr/bin/env node
// News on Ferrite: real stories from publishers' feeds, read by the server
// through its declared `news` egress, and the person's channels, Saved Stories
// and History kept on the server. Opens News from Spotlight, checks that Today
// shows headlines the server read from the followed channels' feeds, opens a
// story (History), saves it, opens the full story in Safari (`openUrl`: no Safari window is open,
// so Safari opens for it, with the story in a new tab in front), copies the story's link from
// Share (pasted back into the search field), follows NASA and blocks Ars Technica
// from Discover, reads the Science topic, reloads and finds all of it again,
// and checks that another browser (another person) sees none of it. Exits 0
// only when every step passed and the page logged no console error, page
// error, failed request or HTTP error of the desktop's own origin (pictures
// load from publishers, whose hiccups are not the app's). Removes what it wrote.
//
//   ferrite dev --egress allow                         # in ferrite-apps/desktop
//   node e2e/news-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                             [--browser chromium|chrome|firefox|webkit]

import path from "node:path";
import { api, journey, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";

const LIBRARY = "/api/news/library";
const SAFARI_TABS = "/api/safari/tabs";
const { base, out, browserName } = options();
const { step, run } = journey("news", { ignoreOtherOrigins: true });

/** The next PUT of the library whose body passes `accept`. */
const nextSave = (page, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new globalThis.URL(response.url()).pathname === LIBRARY &&
      accept(JSON.parse(response.request().postData() ?? "null")?.library),
    { timeout: 15_000 },
  );

async function open(page) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill("News");
  await field.press("Enter");
  const window = page.getByRole("region", { name: "News", exact: true }).first();
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

const sidebar = (window) => window.getByRole("navigation", { name: "Channels" });

/** The headlines of the stories shown, once at least `least` are. */
async function headlines(window, least = 1) {
  const links = window.locator(".mac-news-story-link");
  await links.nth(least - 1).waitFor({ state: "visible", timeout: 30_000 });
  return links.evaluateAll((all) => all.map((link) => link.textContent?.trim() ?? ""));
}

/**
 * The paragraphs the reader shows for a feed story's summary, as `summaryParagraphs` in
 * demos/news/news-live.ts splits them (blank lines part them). A feed item may give no summary at
 * all (NPR's often do not): the reader then says so, and Saved Stories keeps none.
 */
const summaryParagraphs = (summary) =>
  (typeof summary === "string" ? summary : "")
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter((text) => text !== "");

/** Text with its runs of white space collapsed, as the page renders it. */
const collapse = (text) =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

await run(async (page) => {
  await openDesktop(page, base, step);
  await api(page, "DELETE", LIBRARY);
  // Read Full Story opens Safari, which keeps its tabs: a session that had none is left with none.
  const safariTabs = await api(page, "GET", SAFARI_TABS);
  await reloadDesktop(page);
  let other;
  try {
    await steps(page, (context) => {
      other = context;
    });
  } finally {
    // Whatever happened, leave no News behind for the next run.
    await other?.close().catch(() => {});
    await api(page, "DELETE", LIBRARY).catch(() => {});
    if (Array.isArray(safariTabs.json?.tabs)) {
      // Tabs the session had before: put back as they were, on the current revision.
      const current = await api(page, "GET", SAFARI_TABS).catch(() => null);
      if (current?.status === 200)
        await api(page, "PUT", SAFARI_TABS, {
          tabs: safariTabs.json.tabs,
          active: safariTabs.json.active,
          rev: current.json.rev,
        }).catch(() => {});
    } else {
      await api(page, "DELETE", SAFARI_TABS).catch(() => {});
    }
  }
});

async function steps(page, keepOther) {
  let window = await open(page);
  step("News opens from Spotlight", await window.isVisible());

  // Today: the newest stories of BBC News, NPR, The Guardian and Ars Technica.
  const today = await headlines(window, 5);
  const feeds = {};
  for (const id of ["bbc", "npr", "guardian", "ars"]) {
    feeds[id] = await api(page, "GET", `/api/news/sources/${id}`);
  }
  const read = Object.values(feeds).filter(
    (feed) => feed.status === 200 && feed.json.stories?.length > 0,
  );
  step(
    "the server read the four followed channels' feeds from their publishers",
    read.length === 4,
    Object.entries(feeds)
      .map(([id, feed]) => `${id}: ${feed.status} ${feed.json.stories?.length ?? feed.json.error}`)
      .join(", "),
  );
  const titles = new Set(
    Object.values(feeds).flatMap((feed) => (feed.json.stories ?? []).map((s) => s.title)),
  );
  step(
    "Today shows five headlines, every one from those feeds",
    today.length >= 5 && today.slice(0, 5).every((title) => titles.has(title)),
    today.slice(0, 2).join(" | "),
  );
  const links = Object.values(feeds).flatMap((feed) =>
    (feed.json.stories ?? []).map((s) => s.link ?? ""),
  );
  step(
    "the stories link to their publishers",
    links.some((link) => /^https:\/\/www\.bbc\.(co\.uk|com)\//.test(link)) &&
      links.some((link) => /^https:\/\/(www\.)?npr\.org\//.test(link)),
  );

  // Open a lead (the first whose feed item gives a summary, so the saved summary is exercised;
  // the first lead when none does): History records it; then save it.
  const summarised = (title) =>
    Object.values(feeds).some((feed) =>
      (feed.json.stories ?? []).some(
        (story) => story.title === title && summaryParagraphs(story.summary).length > 0,
      ),
    );
  const first = today.find(summarised) ?? today[0];
  const visited = nextSave(page, (body) => body?.history?.[0]?.title === first);
  await window.getByRole("button", { name: first, exact: true }).first().click();
  const reader = window.getByRole("heading", { level: 2, name: first, exact: true });
  await reader.waitFor({ state: "visible", timeout: 10_000 });
  step("the story opens with its headline", await reader.isVisible());
  step("opening it is kept in History", (await visited).status() === 200);
  // The story is the one History kept, found by its channel and id, not by its headline, which
  // two channels' stories can share; its feed item says whether there is a summary to show.
  const entry = JSON.parse((await visited).request().postData() ?? "null")?.library?.history?.[0];
  const feedStory = (feeds[entry?.source]?.json.stories ?? []).find(
    (story) => story.id === entry?.id,
  );
  const expected = summaryParagraphs(feedStory?.summary).map(collapse);
  const publisher = feeds[entry?.source]?.json.source?.publisher ?? "";
  const shownParagraphs = (await window.locator(".mac-news-paragraph").allInnerTexts()).map(
    collapse,
  );
  step(
    "the story shows its summary from the feed, or says the feed gives none",
    Boolean(feedStory) &&
      (expected.length > 0
        ? shownParagraphs.length === expected.length &&
          expected.every((text, i) => shownParagraphs[i] === text)
        : shownParagraphs.length === 1 &&
          shownParagraphs[0] === `${publisher} gives no summary of this story in its feed.`),
    `${entry?.source}/${entry?.id}: feed gives ${expected.length} paragraph(s), reader shows ${shownParagraphs.length}: ${(shownParagraphs[0] ?? "").slice(0, 80)}`,
  );

  const saved = nextSave(page, (body) => body?.saved?.[0]?.title === first);
  await window.getByRole("button", { name: "Save Story" }).click();
  step("Save Story is kept", (await saved).status() === 200);

  // Read Full Story: the story opens in Safari through `openUrl`. No Safari window is open, so
  // Safari opens for it and takes it in a new tab in front, at the story's own link (it then
  // shows the page, or says it opens outside Safari).
  const storyLink = feedStory?.link;
  // The address Safari is handed: the story's link as the URL parser writes it.
  const storyAddress = storyLink ? new URL(storyLink).href : "";
  const keptTab = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === SAFARI_TABS &&
      (JSON.parse(response.request().postData() ?? "{}").tabs ?? []).includes(storyAddress),
    { timeout: 20_000 },
  );
  await window.getByRole("button", { name: "Read Full Story" }).click();
  const said = (await window.locator(".mac-news-actions + .mac-news-status").innerText()).trim();
  const safari = page.getByRole("region", { name: "Safari", exact: true }).first();
  await safari.waitFor({ state: "visible", timeout: 15_000 });
  const tabs = JSON.parse((await keptTab).request().postData() ?? "{}");
  const front = tabs.tabs?.[tabs.active] ?? "";
  const shown = await safari
    .getByRole("textbox", { name: "Search or enter website name" })
    .inputValue();
  step(
    "Read Full Story opens the story in Safari, opened for it, in a new tab in front at the story's exact link",
    Boolean(storyLink) &&
      /in Safari\.$/.test(said) &&
      front === storyAddress &&
      shown === storyAddress,
    `${said}; tab ${front}; field ${shown} (story link ${storyLink})`,
  );
  await shot(page, path.join(out, `news-in-safari-${browserName}.png`));

  // Share > Copy Link (desktop-share-link.tsx): pasted into the search field, the clipboard holds
  // the story's link; Mail, which takes no shared link yet, is dimmed with its reason.
  window = await open(page);
  await window.getByRole("button", { name: "Share" }).click();
  const shareMail = page.getByRole("menuitem", { name: "Mail", exact: true });
  await shareMail.waitFor({ timeout: 5_000 });
  const mailDimmed = (await shareMail.getAttribute("aria-disabled")) === "true";
  const mailReason = mailDimmed ? await shareMail.getAttribute("title") : null;
  await page.getByRole("menuitem", { name: "Copy Link" }).click();
  const search = window.getByRole("searchbox").first();
  await search.click();
  await page.keyboard.press("Control+KeyV");
  const pasted = await search.inputValue();
  await search.fill("");
  step(
    "Share > Copy Link puts the story's link on the clipboard, and Mail is enabled or dimmed with its reason",
    Boolean(storyLink) &&
      pasted === storyAddress &&
      (!mailDimmed || /can’t take a shared link/.test(mailReason ?? "")),
    `${pasted}; ${mailDimmed ? mailReason : "Mail enabled"}`,
  );

  // Discover: follow NASA, block Ars Technica.
  await sidebar(window).getByRole("button", { name: "Discover Channels" }).click();
  const followed = nextSave(page, (body) => body?.following?.includes("nasa"));
  await window.getByRole("button", { name: "Follow NASA" }).click();
  step("following NASA is kept", (await followed).status() === 200);
  const blocked = nextSave(
    page,
    (body) => body?.blocked?.includes("ars") && !body.following.includes("ars"),
  );
  await window.getByRole("button", { name: "Block Ars Technica" }).click();
  step(
    "blocking Ars Technica is kept, and it is no longer followed",
    (await blocked).status() === 200,
  );

  // A topic merges several publishers' topic feeds.
  await sidebar(window).getByRole("button", { name: "Science" }).click();
  const science = await headlines(window, 3);
  step("the Science topic lists real stories", science.length >= 3, `${science.length} stories`);

  const stored = await api(page, "GET", LIBRARY);
  // Saved Stories keeps a short summary only when the feed gave one (news-live.ts `snapshot`).
  const savedSummary = stored.json.library?.saved?.[0]?.summary;
  step(
    "the server holds the history, the saved story with its summary when the feed gives one, and the channels",
    stored.json.library?.history?.[0]?.title === first &&
      stored.json.library?.saved?.[0]?.title === first &&
      (expected.length > 0
        ? typeof savedSummary === "string" && savedSummary.trim() !== ""
        : savedSummary === undefined) &&
      stored.json.library?.following?.includes("nasa") &&
      stored.json.library?.blocked?.includes("ars"),
    `rev ${stored.json.rev}; feed summary ${expected.length > 0 ? "given" : "none"}, saved summary ${typeof savedSummary}`,
  );

  await reloadDesktop(page);
  window = await open(page);
  const following = await sidebar(window).getByRole("button").allTextContents();
  step(
    "after a reload, NASA is followed and Ars Technica is not",
    following.some((text) => text.includes("NASA")) &&
      !following.some((text) => text.includes("Ars Technica")),
  );
  await sidebar(window).getByRole("button", { name: "Saved Stories" }).click();
  const kept = await headlines(window, 1);
  step("after a reload, Saved Stories lists the story", kept.includes(first));
  await sidebar(window).getByRole("button", { name: "Today" }).click();
  await headlines(window, 5);
  await shot(page, path.join(out, `news-${browserName}.png`));

  // Another browser is another person: it sees nothing of this one's News. It opens the desktop
  // first, as a person does, so it has a session (and signs in where the desktop asks).
  const other = await page.context().browser().newContext();
  keepOther(other);
  const otherPage = await other.newPage();
  await openDesktop(otherPage, base, step);
  const theirs = await api(otherPage, "GET", LIBRARY);
  step(
    "another browser has its own News, empty",
    theirs.status === 200 && theirs.json.library === null,
  );
}

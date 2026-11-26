#!/usr/bin/env node
// Podcasts' rows of the inventory that no other journey pictured, against Apple's real directory, real
// NPR feeds and real publishers' audio, read back from the audio element, the window and the server.
// A run is one part, so that each stays well under ten minutes:
//
//   views  Search, the places, a show's page, Listen Now, banners, an unreachable feed, Downloaded,
//          the App Store, the sidebar's menu and Hide Sidebar.
//   play   The Controls menu, the playback bar, the Up Next panel with Edit and Delete, keys, settings,
//          the library and the place across a reload.
//   drag   An episode dragged to Up Next and within it, out to TextEdit, and an OPML file and a feed's
//          address dropped on the window. The address is a dispatched `drop` event: a browser test
//          cannot drag from another application. The rest are real mouse drags.
//
// Two things are written through the library's API, because a real feed will not produce them on
// demand: an older "newest seen" time, which makes a show's episodes new, and a show whose feed does
// not exist, on a host the server may read.
//
//   node e2e/podcasts-rows-journey.mjs --part views|play|drag [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const at = process.argv.indexOf("--part");
const part = at > 0 ? process.argv[at + 1] : "views";
const { step, run, expectRefusal } = journey(`podcasts-rows-${part}`, {
  ignoreOtherOrigins: true,
  launchOptions: { chromium: { args: ["--autoplay-policy=no-user-gesture-required"] } },
});

const LIBRARY = "/api/podcasts/library";
const SETTINGS = "/api/system-preferences/settings";
const SHOW = "Up First from NPR";
const SHOW_ID = "1222114325";
const FEED_UP_FIRST = "https://feeds.npr.org/510318/podcast.xml";
const FEED_PLANET_MONEY = "https://feeds.npr.org/510289/podcast.xml";
const FEED_THROUGHLINE = "https://feeds.npr.org/510333/podcast.xml";
const FEED_INDICATOR = "https://feeds.npr.org/510325/podcast.xml";
const FEED_MISSING = "https://feeds.npr.org/999999999/podcast.xml";
const SERVER = 60_000;

const stored = async (page) => (await api(page, "GET", LIBRARY)).json?.library ?? null;
const settled = async (page, name) => {
  await page.waitForTimeout(400);
  await shot(page, path.join(out, name));
};

// The desktop's own requests under way. A reload or the end of the run would cut them off, which is
// the journey's doing, so each waits for them.
const underWay = new Set();
function followRequests(page) {
  page.on("request", (request) => {
    const { origin, pathname } = new URL(request.url());
    if (origin === new URL(base).origin && pathname.startsWith("/api/")) underWay.add(request);
  });
  page.on("requestfinished", (request) => underWay.delete(request));
  page.on("requestfailed", (request) => underWay.delete(request));
}
const quiet = () => until(async () => underWay.size === 0, SERVER);
const reload = async (page) => {
  await quiet();
  await reloadDesktop(page);
};
/** The library with `change` made to it, written through its API: the journey's seed. */
async function seed(page, change) {
  await quiet();
  const { library, rev } = (await api(page, "GET", LIBRARY)).json;
  const { status } = await api(page, "PUT", LIBRARY, { library: change(library), rev });
  if (status !== 200) throw new Error(`the seed was refused: ${status}`);
  await quiet();
}
/** A sidebar row by its label: a row's accessible name also holds the count of new episodes it shows. */
const place = (window, name) =>
  window
    .getByRole("tree", { name: "Podcasts" })
    .getByRole("treeitem", { name: new RegExp(`^${name}( \\d+)?$`) });
const menuBarItem = (page, title) =>
  page.getByRole("menubar").first().getByRole("menuitem", { name: title, exact: true });
const heading = (window, name) => window.getByRole("heading", { name, exact: true }).first();
const audio = (page, property) =>
  page.evaluate((key) => document.querySelector("audio.mac-podcasts-audio")[key], property);

async function openPodcasts(page) {
  await launch(page, "Podcasts");
  const window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: SERVER });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: SERVER },
  );
  return window;
}

/** File > Add a Show by URL, on a real feed. */
async function addShow(page, feed) {
  await chooseMenu(page, "File", "Add a Show by URL…");
  const sheet = page.getByRole("dialog", { name: "Add a Show by URL" });
  await sheet.getByRole("textbox", { name: "Feed address" }).fill(feed);
  await sheet.getByRole("button", { name: "Add", exact: true }).click();
  await sheet.waitFor({ state: "detached", timeout: SERVER });
  await until(async () => (await stored(page))?.shows?.some((show) => show.feed === feed), SERVER);
}

/** The first `count` episodes of the Episodes place, by the titles their Play buttons name. */
async function episodeTitles(page, window, count) {
  await place(window, "Episodes").click();
  const plays = window.getByRole("button", { name: /^Play / });
  await plays.first().waitFor({ timeout: SERVER });
  const titles = [];
  for (let index = 0; index < count; index += 1) {
    titles.push(((await plays.nth(index).getAttribute("aria-label")) ?? "").replace(/^Play /, ""));
  }
  return titles;
}

async function views(page) {
  await openDesktop(page, base, step);
  const window = await openPodcasts(page);

  // ---- Search and a show's page -------------------------------------------------------------------
  await window.getByRole("searchbox").fill("Up First");
  const shows = window.getByRole("region", { name: "Shows", exact: true });
  const card = shows.getByRole("button", { name: new RegExp(`^${SHOW}`) }).first();
  await card.waitFor({ timeout: SERVER });
  step("Search finds a show in Apple's directory", true);
  await settled(page, "podcasts-rows-search.png");

  await card.click();
  const episodes = window.getByRole("region", { name: "Episodes" });
  await episodes
    .getByRole("button", { name: /^Play / })
    .first()
    .waitFor({ timeout: SERVER });
  step(
    "A show's page lists its episodes from its feed",
    (await episodes.getByRole("button", { name: /^Play / }).count()) > 1,
  );
  await window.getByRole("button", { name: "Subscribe", exact: true }).click();
  step(
    "Subscribe follows the show on the server",
    await until(
      async () => (await stored(page))?.shows?.some((show) => show.id === SHOW_ID),
      SERVER,
    ),
  );
  await window
    .getByRole("button", { name: "Unsubscribe", exact: true })
    .waitFor({ timeout: 5_000 });
  await settled(page, "podcasts-rows-show-page.png");
  await addShow(page, FEED_PLANET_MONEY);

  // ---- Apple's chart ------------------------------------------------------------------------------
  await place(window, "Browse").click();
  const featured = window.getByRole("region", { name: "Featured" });
  await featured.waitFor({ timeout: SERVER });
  step(
    "Browse shows Apple's chart: Featured over Popular Shows",
    (await window.getByRole("region", { name: "Popular Shows" }).count()) === 1 &&
      (await featured.getByRole("button").count()) > 0,
  );
  await settled(page, "podcasts-rows-browse.png");

  await place(window, "Top Charts").click();
  const top = window.getByRole("region", { name: "Top Shows" });
  await top.waitFor({ timeout: SERVER });
  step(
    "Top Charts ranks the chart's shows",
    /^1\. /.test(await top.locator("button").first().innerText()),
  );
  await settled(page, "podcasts-rows-top-charts.png");

  // ---- The library's places -----------------------------------------------------------------------
  const newest = async (feed) => {
    const reply = await api(
      page,
      "GET",
      `/api/podcasts/feed?url=${encodeURIComponent(feed)}&max_age=3600`,
    );
    return Math.max(...(reply.json?.feed?.episodes ?? []).map((one) => one.published ?? 0));
  };
  const library = await stored(page);
  const followed = library.shows;
  const times = await Promise.all(followed.map((show) => newest(show.feed)));
  const byNewest = followed
    .map((show, index) => ({ title: show.title, time: times[index] }))
    .sort((a, b) => b.time - a.time)
    .map(({ title }) => title);
  const cards = () => window.locator(".mac-card-grid-card-title").allInnerTexts();

  await place(window, "Recently Updated").click();
  await heading(window, "Recently Updated").waitFor({ timeout: 5_000 });
  await until(async () => (await cards()).length === 2, SERVER);
  step(
    "Recently Updated lists the followed shows, the newest episode first",
    (await cards()).join("|") === byNewest.join("|"),
    (await cards()).join(" / "),
  );
  await settled(page, "podcasts-rows-recently-updated.png");

  await place(window, "Shows").click();
  await heading(window, "Shows").waitFor({ timeout: 5_000 });
  await until(async () => (await cards()).length === 2, SERVER);
  const alphabetical = (await cards()).join("|");
  step(
    "Shows lists them by name",
    alphabetical === [...(await cards())].sort((a, b) => a.localeCompare(b)).join("|"),
    alphabetical,
  );
  await settled(page, "podcasts-rows-shows.png");

  await place(window, "Episodes").click();
  await heading(window, "Episodes").waitFor({ timeout: 5_000 });
  const list = window.locator("[data-episode-id]");
  await list.first().waitFor({ timeout: SERVER });
  const subtitles = await list.locator(".mac-card-grid-card-subtitle").allInnerTexts();
  step(
    "Episodes lists the episodes of both shows",
    subtitles.some((text) => text.startsWith("Up First")) &&
      subtitles.some((text) => text.startsWith("Planet Money")),
    `${await list.count()} episodes`,
  );
  await settled(page, "podcasts-rows-episodes.png");

  await place(window, "Downloaded").click();
  await heading(window, "Downloaded").waitFor({ timeout: 5_000 });
  step(
    "Downloaded holds nothing and says why",
    /never downloaded/.test(await window.locator(".mac-podcasts-note").first().innerText()),
  );
  await settled(page, "podcasts-rows-downloaded.png");

  // ---- The sidebar: its menu and Hide Sidebar -----------------------------------------------------
  await place(window, "Shows").click({ button: "right" });
  const refreshAll = page.getByRole("menuitem", { name: "Refresh All Shows" });
  await refreshAll.waitFor({ timeout: 5_000 });
  await settled(page, "podcasts-rows-sidebar-menu.png");
  const reread = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/podcasts/feed" &&
      /max_age=0(&|$)/.test(response.url()),
    { timeout: SERVER },
  );
  await refreshAll.click();
  step("The sidebar's menu: Refresh All Shows reads the feeds again", (await reread).ok());
  // The feed can answer inside the menu's closing fade.
  step(
    "its menu has closed",
    await until(
      async () => (await page.getByRole("menuitem", { name: "Mark All as Seen" }).count()) === 0,
      5_000,
    ),
  );

  await place(window, "Shows").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide Sidebar" }).click();
  const tree = window.getByRole("tree", { name: "Podcasts" });
  await tree.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Hide Sidebar in the menu hides the places and the search field, leaving the window's controls",
    (await window.getByRole("searchbox").count()) === 0 &&
      (await window.getByRole("button", { name: "Close" }).first().isVisible()),
  );
  await settled(page, "podcasts-rows-sidebar-hidden.png");
  step(
    "Hidden is kept in the desktop's settings",
    await until(
      async () =>
        (await api(page, "GET", SETTINGS)).json?.values?.["podcasts.sidebarShown"] === false,
      SERVER,
    ),
  );
  await reload(page);
  const again = await openPodcasts(page);
  step(
    "It stays hidden over a reload",
    (await again.getByRole("tree", { name: "Podcasts" }).count()) === 0,
  );
  const view = await menuItemState(page, "View", "Show Sidebar");
  step("View's row now says Show Sidebar", !view.disabled);
  await chooseMenu(page, "View", "Show Sidebar");
  await again.getByRole("tree", { name: "Podcasts" }).waitFor({ timeout: 5_000 });
  step("View > Show Sidebar brings it back", true);
  await again.getByRole("heading").first().click();
  await page.keyboard.press("Alt+ControlOrMeta+s");
  await again
    .getByRole("tree", { name: "Podcasts" })
    .waitFor({ state: "detached", timeout: 5_000 });
  step("⌥⌘S hides it", true);
  await chooseMenu(page, "Edit", "Find");
  await again.getByRole("tree", { name: "Podcasts" }).waitFor({ timeout: 5_000 });
  const searchHasKeyboard = () =>
    until(
      () =>
        again.locator('input[type="search"]').evaluate((field) => document.activeElement === field),
      5_000,
    );
  step("Edit > Find shows it again and gives the field the keyboard", await searchHasKeyboard());
  await again.getByRole("heading").first().click();
  await page.keyboard.press("Alt+ControlOrMeta+s");
  await again
    .getByRole("tree", { name: "Podcasts" })
    .waitFor({ state: "detached", timeout: 5_000 });
  await page.keyboard.press("ControlOrMeta+f");
  await again.getByRole("tree", { name: "Podcasts" }).waitFor({ timeout: 5_000 });
  step("⌘F does the same", await searchHasKeyboard());

  // ---- New episodes and the banners ---------------------------------------------------------------
  await seed(page, (library) => ({
    ...library,
    shows: library.shows.map((show) => (show.id === SHOW_ID ? { ...show, seen: 1 } : show)),
  }));
  await reload(page);
  let shown = await openPodcasts(page);
  await place(shown, "Listen Now").click();
  const banner = shown.getByText(/new episodes? (from \d+ shows )?since you last looked/);
  await banner.waitFor({ timeout: SERVER });
  step("A banner counts the new episodes", true, await banner.innerText());
  const fresh = shown.getByRole("region", { name: "New Episodes" });
  await fresh.waitFor({ timeout: 5_000 });
  step(
    "Listen Now lists them, and the sidebar counts them",
    (await fresh.locator("[data-episode-id]").count()) > 0 &&
      /\d/.test(await place(shown, "Listen Now").innerText()),
  );
  await settled(page, "podcasts-rows-new-episodes.png");
  await shown.getByRole("button", { name: "Mark as Seen" }).first().click();
  await banner.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Mark as Seen takes the banner away and keeps the newest episode on the server",
    await until(
      async () => (await stored(page)).shows.find((show) => show.id === SHOW_ID).seen > 1,
      SERVER,
    ),
  );

  // ---- A feed that cannot be read -----------------------------------------------------------------
  await seed(page, (library) => ({
    ...library,
    subscribed: [...library.subscribed, "feed-missing"],
    shows: [
      ...library.shows,
      {
        id: "feed-missing",
        title: "A Show Gone Away",
        author: "",
        artwork: null,
        genre: null,
        feed: FEED_MISSING,
        seen: 1,
      },
    ],
  }));
  // Each read of the feed is refused: the one on the reload and the one the show's page makes.
  for (const status of [502, 502, 502, 404]) expectRefusal(status, "/api/podcasts/feed");
  await reload(page);
  shown = await openPodcasts(page);
  await place(shown, "Shows").click();
  await shown.getByRole("button", { name: /^A Show Gone Away/ }).click();
  const note = shown.getByRole("status");
  await note.filter({ hasText: "could not be read" }).waitFor({ timeout: SERVER });
  step(
    "A feed that cannot be read says so on its show's page",
    true,
    await note.first().innerText(),
  );
  await settled(page, "podcasts-rows-unreachable.png");

  // ---- The App Store ------------------------------------------------------------------------------
  await page
    .getByRole("button", { name: /^App Store$/ })
    .first()
    .click();
  const store = page
    .locator(".mac-window")
    .filter({ has: page.getByRole("heading", { name: "Get More Apps" }) })
    .first();
  await store.waitFor({ state: "visible", timeout: SERVER });
  const inStore = store.getByRole("button", { name: "Open, Podcasts" });
  await inStore.waitFor({ timeout: SERVER });
  await settled(page, "podcasts-rows-app-store.png");
  await inStore.click();
  await shown.waitFor({ state: "visible", timeout: SERVER });
  step("The App Store lists Podcasts as got, and Open opens it", true);
}

async function play(page) {
  await openDesktop(page, base, step);
  let window = await openPodcasts(page);
  await addShow(page, FEED_UP_FIRST);
  const [first, second, third, fourth, fifth] = await episodeTitles(page, window, 5);

  // ---- The Controls menu --------------------------------------------------------------------------
  const empty = await menuItemState(page, "Controls", "Play Next in Up Next");
  step("Play Next in Up Next is dimmed with nothing queued", empty.disabled);
  await window.getByRole("button", { name: `Play ${first}`, exact: true }).click();
  step(
    "An episode plays from its publisher",
    await until(async () => (await audio(page, "currentTime")) > 0, 60_000),
  );

  await chooseMenu(page, "Controls", "Pause");
  step("Controls > Pause pauses the audio", await until(() => audio(page, "paused"), 5_000));
  await chooseMenu(page, "Controls", "Play");
  step(
    "Controls > Play plays it on",
    await until(async () => !(await audio(page, "paused")), 5_000),
  );
  await chooseMenu(page, "Controls", "Pause");
  await until(() => audio(page, "paused"), 5_000);
  const from = await audio(page, "currentTime");
  await chooseMenu(page, "Controls", "Skip Forward 30 Seconds");
  step(
    "Controls > Skip Forward moves the paused audio on 30 seconds",
    await until(async () => Math.abs((await audio(page, "currentTime")) - from - 30) < 1, 5_000),
    `${from} to ${await audio(page, "currentTime")}`,
  );
  const on = await audio(page, "currentTime");
  await chooseMenu(page, "Controls", "Skip Back 15 Seconds");
  step(
    "Controls > Skip Back moves it back 15 seconds",
    await until(async () => Math.abs(on - (await audio(page, "currentTime")) - 15) < 1, 5_000),
    `${on} to ${await audio(page, "currentTime")}`,
  );
  await menuBarItem(page, "Controls").click();
  await settled(page, "podcasts-rows-controls.png");
  await closeMenus(page);

  // ---- The playback bar ---------------------------------------------------------------------------
  const bar = window.getByRole("toolbar", { name: "Playback controls" });
  await bar.getByRole("button", { name: "Playback speed 1×" }).click();
  await bar.getByRole("button", { name: "Playback speed 1.25×" }).waitFor({ timeout: 5_000 });
  step(
    "The bar's speed button sets the audio's speed, kept on the server",
    (await audio(page, "playbackRate")) === 1.25 &&
      (await until(async () => (await stored(page)).speed === 1.25, SERVER)),
  );
  const level = await audio(page, "volume");
  await bar.getByRole("slider").last().focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  step(
    "The bar's volume slider sets the audio's volume",
    await until(async () => (await audio(page, "volume")) < level, 3_000),
    `${level} to ${await audio(page, "volume")}`,
  );
  const display = bar.getByRole("group", { name: "Now Playing" });
  step("The bar's display names the episode", (await display.innerText()).includes(first));
  const skip = bar.getByRole("button", { name: "Forward 30 seconds" });
  const past = await audio(page, "currentTime");
  await skip.click();
  step(
    "The bar's Forward button moves it by its seconds",
    await until(async () => (await audio(page, "currentTime")) >= past + 29, 5_000),
  );
  await settled(page, "podcasts-rows-bar.png");

  // ---- Keys ---------------------------------------------------------------------------------------
  const reread = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/podcasts/feed" &&
      /max_age=0(&|$)/.test(response.url()),
    { timeout: SERVER },
  );
  await window.getByRole("heading").first().click();
  await page.keyboard.press("ControlOrMeta+r");
  step("⌘R reads the feeds again", (await reread).ok());

  await window.getByRole("searchbox").focus();
  await page.keyboard.press("ControlOrMeta+,");
  const prefs = page.locator(".mac-podcasts-preferences").first();
  await prefs.waitFor({ state: "visible", timeout: 10_000 });
  step("⌘, opens Preferences", true);

  // ---- Settings -----------------------------------------------------------------------------------
  await prefs.getByRole("tab", { name: "Playback" }).click();
  await prefs.getByRole("combobox", { name: "Skip Forward:" }).click();
  await page.getByRole("option", { name: "45 Seconds" }).click();
  await prefs.getByRole("checkbox", { name: "Continuous Playback" }).click();
  await settled(page, "podcasts-rows-preferences.png");
  step(
    "Preferences' Skip Forward and Continuous Playback are kept on the server",
    await until(async () => {
      const { settings } = await stored(page);
      return settings.skipForward === 45 && settings.continuous === false;
    }, SERVER),
  );
  await prefs.getByRole("button", { name: "Close" }).first().click();
  step(
    "Skip Forward's new seconds are the bar's and Controls'",
    (await bar.getByRole("button", { name: "Forward 45 seconds" }).count()) === 1 &&
      !(await menuItemState(page, "Controls", "Skip Forward 45 Seconds")).disabled,
  );

  // ---- Up Next: the panel and its Edit ------------------------------------------------------------
  for (const title of [second, third, fourth, fifth]) {
    await window.getByRole("button", { name: `Add ${title} to Up Next`, exact: true }).click();
  }
  await until(async () => (await stored(page)).queue?.length === 4, SERVER);
  await bar.getByRole("button", { name: "Up Next" }).click();
  const panel = window.getByRole("region", { name: "Queue" });
  await panel.waitFor({ timeout: 5_000 });
  const queued = async () => (await stored(page)).queue.map((one) => one.title);
  await panel.getByRole("button", { name: `Change ${second} in Up Next` }).click();
  await page.getByRole("menuitem", { name: "Move Down" }).click();
  step(
    "Up Next's Edit: Move Down moves an episode, on the server",
    await until(
      async () => (await queued()).join("|") === [third, second, fourth, fifth].join("|"),
      SERVER,
    ),
  );
  await panel.getByRole("button", { name: `Change ${second} in Up Next` }).click();
  await page.getByRole("menuitem", { name: "Move Up" }).click();
  await until(
    async () => (await queued()).join("|") === [second, third, fourth, fifth].join("|"),
    SERVER,
  );
  await panel.getByRole("button", { name: `Change ${third} in Up Next` }).click();
  await page.getByRole("menuitem", { name: "Remove from Up Next" }).click();
  step(
    "and Remove from Up Next takes one out",
    await until(
      async () => (await queued()).join("|") === [second, fourth, fifth].join("|"),
      SERVER,
    ),
  );
  await settled(page, "podcasts-rows-up-next-panel.png");

  // ---- Delete -------------------------------------------------------------------------------------
  const row = (title) =>
    panel
      .locator("[data-episode-id]")
      .filter({ hasText: title })
      .locator(".mac-card-grid-card-text")
      .first();
  await row(fifth).click();
  await settled(page, "podcasts-rows-up-next-chosen.png");
  await page.keyboard.press("Delete");
  step(
    "Delete removes the episode chosen from Up Next",
    await until(async () => (await queued()).join("|") === [second, fourth].join("|"), SERVER),
  );

  // ---- Play Next ----------------------------------------------------------------------------------
  await chooseMenu(page, "Controls", "Play Next in Up Next");
  step(
    "Play Next in Up Next loads the first queued, which leaves Up Next",
    await until(async () => {
      const library = await stored(page);
      return library.current?.title === second && library.queue.length === 1;
    }, SERVER),
  );
  step(
    "and it plays",
    await until(
      async () => !(await audio(page, "paused")) && (await audio(page, "currentTime")) > 0,
      60_000,
    ),
  );
  await chooseMenu(page, "Controls", "Pause");
  await until(() => audio(page, "paused"), 5_000);
  await audio(page, "currentTime");

  // ---- Listen Now's Up Next and Continue Listening --------------------------------------------------
  await bar.getByRole("button", { name: "Up Next" }).click();
  await place(window, "Listen Now").click();
  await window.getByRole("region", { name: "Up Next" }).waitFor({ timeout: 5_000 });
  const going = window.getByRole("region", { name: "Continue Listening" });
  await going.waitFor({ timeout: SERVER });
  step(
    "Listen Now shows Up Next and the episode started earlier in Continue Listening",
    (await window.getByRole("region", { name: "Up Next" }).innerText()).includes(fourth) &&
      (await going.innerText()).includes(first),
  );
  await settled(page, "podcasts-rows-listen-now.png");

  // ---- Over a reload ------------------------------------------------------------------------------
  await window.getByRole("button", { name: `Play ${first}` }).click();
  await until(async () => (await audio(page, "currentTime")) > 0, 60_000);
  await chooseMenu(page, "Controls", "Pause");
  await until(() => audio(page, "paused"), 5_000);
  await chooseMenu(page, "Controls", "Skip Forward 45 Seconds");
  await page.waitForTimeout(500);
  const kept = Math.floor(await audio(page, "currentTime"));
  await until(async () => {
    const library = await stored(page);
    return library.positions[library.current?.id] === kept;
  }, SERVER);
  const before = await stored(page);
  step(
    "The place in the episode is kept on the server",
    before.positions[before.current?.id] === kept,
    `${kept}`,
  );
  await reload(page);
  window = await openPodcasts(page);
  const after = await stored(page);
  step(
    "Over a reload the library holds the follow, Up Next, the speed and the settings",
    after.shows.some((show) => show.feed === FEED_UP_FIRST) &&
      after.queue.some((one) => one.title === fourth) &&
      after.speed === 1.25 &&
      after.settings.skipForward === 45 &&
      after.settings.continuous === false,
  );
  await menuBarItem(page, "Controls").waitFor({ timeout: 5_000 });
  await window.getByRole("group", { name: "Now Playing" }).waitFor({ timeout: SERVER });
  await settled(page, "podcasts-rows-after-reload.png");
  await chooseMenu(page, "Controls", "Play");
  step(
    "Controls > Play goes on from the place kept",
    await until(async () => {
      const now = await audio(page, "currentTime");
      return now >= kept - 1 && now < kept + 30 && !(await audio(page, "paused"));
    }, 60_000),
    `kept ${kept}, at ${await audio(page, "currentTime")}`,
  );
  await chooseMenu(page, "Controls", "Pause");

  // ---- Mark as Played survives; Continue Listening's Delete ------------------------------------------
  await place(window, "Episodes").click();
  const rowOf = (title) => window.locator("[data-episode-id]").filter({ hasText: title }).first();
  await rowOf(third).locator(".mac-card-grid-card-text").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark as Played" }).click();
  step(
    "Played is kept on the server",
    await until(async () => (await stored(page)).played?.length === 1, SERVER),
  );
  await rowOf(second).locator(".mac-card-grid-card-text").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Play Episode" }).click();
  await until(async () => (await stored(page)).current?.title === second, SERVER);
  await chooseMenu(page, "Controls", "Stop");
  await place(window, "Listen Now").click();
  const started = window.getByRole("region", { name: "Continue Listening" });
  await started.waitFor({ timeout: SERVER });
  const idOfFirst = (await stored(page)).positions;
  await started
    .locator("[data-episode-id]")
    .filter({ hasText: first })
    .locator(".mac-card-grid-card-text")
    .click();
  await page.keyboard.press("Delete");
  step(
    "Delete in Continue Listening forgets the place",
    await until(
      async () =>
        Object.keys((await stored(page)).positions).length < Object.keys(idOfFirst).length,
      SERVER,
    ),
  );
}

/** A real pointer drag: pressing, a first move past the threshold, then the way to `to`. */
async function pointerDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.waitForTimeout(200);
  await page.mouse.up();
}

const middle = async (locator) => {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function drag(page) {
  await openDesktop(page, base, step);
  const window = await openPodcasts(page);
  await addShow(page, FEED_UP_FIRST);
  const [first, second, third] = await episodeTitles(page, window, 3);
  const queued = async () => ((await stored(page)).queue ?? []).map((one) => one.title);
  const rowOf = (title) => window.locator("[data-episode-id]").filter({ hasText: title }).first();
  const bar = window.getByRole("toolbar", { name: "Playback controls" });
  const upNext = bar.getByRole("button", { name: "Up Next" });

  // ---- An episode to Up Next ----------------------------------------------------------------------
  await pointerDrag(
    page,
    await middle(rowOf(first).locator(".mac-card-grid-card-text")),
    await middle(upNext),
  );
  step(
    "An episode dragged onto the Up Next button joins Up Next, on the server",
    await until(async () => (await queued()).join("|") === first, SERVER),
    (await queued()).join(" / "),
  );
  await upNext.click();
  const panel = window.getByRole("region", { name: "Queue" });
  await panel.waitFor({ timeout: 5_000 });
  await pointerDrag(
    page,
    await middle(rowOf(second).locator(".mac-card-grid-card-text")),
    await middle(panel),
  );
  step(
    "One dragged onto the open panel joins it too",
    await until(async () => (await queued()).join("|") === [first, second].join("|"), SERVER),
    (await queued()).join(" / "),
  );
  await pointerDrag(
    page,
    await middle(rowOf(third).locator(".mac-card-grid-card-text")),
    await middle(panel.locator("[data-episode-id]").filter({ hasText: second })),
  );
  step(
    "Dropped on an entry, it goes before that entry",
    await until(
      async () => (await queued()).join("|") === [first, third, second].join("|"),
      SERVER,
    ),
    (await queued()).join(" / "),
  );

  // ---- Reorder ------------------------------------------------------------------------------------
  const inPanel = (title) => panel.locator("[data-episode-id]").filter({ hasText: title }).first();
  await pointerDrag(
    page,
    await middle(inPanel(second).locator(".mac-card-grid-card-text")),
    await middle(inPanel(first)),
  );
  step(
    "Up Next reorders by drag, on the server",
    await until(
      async () => (await queued()).join("|") === [second, first, third].join("|"),
      SERVER,
    ),
    (await queued()).join(" / "),
  );
  await settled(page, "podcasts-rows-drag-up-next.png");

  // ---- Out, to TextEdit ---------------------------------------------------------------------------
  await upNext.click();
  const pods = await window.boundingBox();
  await launch(page, "TextEdit");
  const editor = page
    .locator(".mac-window")
    .filter({ has: page.getByRole("textbox") })
    .last();
  const text = editor.getByRole("textbox", { name: "Document" }).first();
  await text.waitFor({ timeout: SERVER });
  // TextEdit moved by its title bar until it sticks out beside Podcasts, which comes to the front when
  // the drag starts.
  const titleBox = await editor.boundingBox();
  await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(pods.x + pods.width - 60, titleBox.y + 10, { steps: 10 });
  await page.mouse.up();
  const box = await text.boundingBox();
  const to = { x: Math.max(box.x + 20, pods.x + pods.width + 12), y: box.y + 40 };
  const onScreen = to.x < box.x + box.width && to.x < 1440;
  await window.locator(".mac-card-grid-card-text").first().waitFor({ timeout: 5_000 });
  const start = await middle(rowOf(third).locator(".mac-card-grid-card-text"));
  await pointerDrag(page, start, to);
  const written = async () =>
    text.evaluate((field) => ("value" in field ? field.value : field.textContent) ?? "");
  step(
    "An episode dragged out to TextEdit gives it the episode's link",
    onScreen && (await until(async () => /https?:\/\/\S*npr\.org/.test(await written()), 5_000)),
    `${onScreen} ${(await written()).slice(0, 90)}`,
  );
  await settled(page, "podcasts-rows-drag-out.png");
  await page.mouse.click(to.x, to.y);
  await editor.getByRole("button", { name: "Close" }).first().click();
  const dontSave = page.getByRole("button", { name: /Don.t Save|Delete/ }).first();
  await dontSave.click({ timeout: 3_000 }).catch(() => {});

  // ---- A feed's address on the window -------------------------------------------------------------
  const dropOn = (data) =>
    window.evaluate((frame, entries) => {
      const transfer = new DataTransfer();
      for (const [type, value] of Object.entries(entries)) transfer.setData(type, value);
      const target = frame.querySelector(".mac-podcasts-main") ?? frame;
      for (const type of ["dragover", "drop"]) {
        target.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
        );
      }
    }, data);
  await launch(page, "Podcasts");
  await dropOn({ "text/plain": "just some words" });
  await window.getByText("Podcasts takes the address of a show's feed").waitFor({ timeout: 5_000 });
  step("Text that is no address is refused, saying why", true);
  await dropOn({ "text/uri-list": `# Planet Money\n${FEED_PLANET_MONEY}\n` });
  step(
    "A feed's address dropped on the window follows the show",
    await until(
      async () => (await stored(page)).shows.some((show) => show.feed === FEED_PLANET_MONEY),
      SERVER,
    ),
  );
  await window
    .getByRole("button", { name: "Unsubscribe", exact: true })
    .waitFor({ timeout: SERVER });
  await settled(page, "podcasts-rows-drop-feed.png");

  // ---- An OPML file from Finder -------------------------------------------------------------------
  const opml = `<?xml version="1.0"?><opml version="2.0"><body><outline type="rss" text="Indicator" xmlUrl="${FEED_INDICATOR}"/><outline type="rss" text="Throughline" xmlUrl="${FEED_THROUGHLINE}"/></body></opml>`;
  const name = `Shows ${Date.now().toString(36)}.opml`;
  await page.evaluate(
    async ({ name, opml }) => {
      const json = { "content-type": "application/json" };
      const bytes = new TextEncoder().encode(opml);
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "documents",
          name,
          size: bytes.length,
          type: "text/x-opml",
          existing: "fail",
        }),
      }).then((reply) => reply.json());
      await fetch(`/api/files/uploads/${started.upload}/0`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" },
        body: bytes,
      });
      await fetch(`/api/files/uploads/${started.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      });
    },
    { name, opml },
  );
  await reload(page);
  const after = await openPodcasts(page);
  await launch(page, "Finder");
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: SERVER });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const file = finder.getByRole("option", { name, exact: true }).first();
  await file.waitFor({ timeout: SERVER });
  const fromBox = await file.boundingBox();
  const finderBox = await finder.boundingBox();
  const podsBox = await after.boundingBox();
  const inFinder = ({ x, y }) =>
    x > finderBox.x &&
    x < finderBox.x + finderBox.width &&
    y > finderBox.y &&
    y < finderBox.y + finderBox.height;
  const target = [
    { x: podsBox.x + podsBox.width - 30, y: podsBox.y + podsBox.height - 30 },
    { x: podsBox.x + 30, y: podsBox.y + podsBox.height - 30 },
    { x: podsBox.x + 30, y: podsBox.y + 200 },
  ].find((point) => !inFinder(point));
  const covered = !target;
  if (target) {
    await pointerDrag(page, { x: fromBox.x + 40, y: fromBox.y + fromBox.height / 2 }, target);
  }
  step(
    "An OPML file dragged from Finder onto the window follows its shows",
    !covered &&
      (await until(async () => {
        const feeds = (await stored(page)).shows.map((show) => show.feed);
        return feeds.includes(FEED_INDICATOR) && feeds.includes(FEED_THROUGHLINE);
      }, 60_000)),
    `covered ${covered}; ${(await stored(page)).shows.map((show) => show.title).join(" / ")}`,
  );
  await settled(page, "podcasts-rows-drop-opml.png");
}

await run(async (page) => {
  followRequests(page);
  if (part === "views") await views(page);
  else if (part === "play") await play(page);
  else if (part === "drag") await drag(page);
  else throw new Error(`--part must be views, play or drag, not ${part}`);
  await quiet();
});

process.exit(0);

#!/usr/bin/env node
// Podcasts on Ferrite with real shows: open Podcasts from Spotlight; in Top Charts, open a show
// before Apple's lookup has given its feed (the lookup's reply is held until the page is open)
// and find its episodes read once the reply arrives; search Apple's directory for
// NPR's Up First (its feed is on feeds.npr.org, a declared host), open it and read its real
// episodes, follow it, play an episode in the browser (the audio element's position advances, and
// its audio comes from the publisher, not from the desktop), set the speed to 1.5x, pause, skip
// forward while paused (only the Forward button can move a paused element), queue another episode
// in Up Next, turn Continuous Playback off in Preferences, and find the server holding the place
// the episode was paused and skipped to. Then reload the page and find the follow, the episode
// loaded, Up Next, the speed and the setting restored, and drive the menu bar's Controls menu:
// Play goes on from the place kept, Pause pauses, Skip Forward moves the paused element by its
// seconds, each read from the audio element. A second browser,
// signed in as a guest of its own, has none of it: no show, episode, place, Up Next, speed or
// setting, in its library or its window. Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error. It removes what it wrote at the end.
//
// It needs the `podcasts` egress handle of ferrite.json and real egress:
//
//   ferrite dev --egress allow                         # in ferrite-apps/desktop
//   node e2e/podcasts-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                                 [--browser chromium|chrome|firefox|webkit]
//
// It is built on app-journey.mjs (options, sign-in, same-origin fetches, screenshots) with a run
// loop of its own: the browser cancels an episode's audio stream when the page reloads or another
// episode is loaded, and that cancelled media request (and only that) is not a failure of the app.

import path from "node:path";
import { api, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { ENGINES, engineFamily } from "./journey-kit.mjs";

const URL_LIBRARY = "/api/podcasts/library";
const SHOW = "Up First from NPR";
const SHOW_ID = "1222114325";
const { base, out, browserName } = options();
// Playback may start without a gesture in every engine (the journey clicks Play anyway).
const launchOptions = {
  chromium: { args: ["--autoplay-policy=no-user-gesture-required"] },
  firefox: {
    firefoxUserPrefs: { "media.autoplay.default": 0, "media.autoplay.blocking_policy": 0 },
  },
  webkit: {},
};
const ABORTED = /ERR_ABORTED|NS_BINDING_ABORTED|NS_ERROR_ABORT|cancelled/i;

const problems = [];
const steps = [];
function step(label, ok, detail = "") {
  steps.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
}

/** Every console error, page error, failed request and HTTP error of a page. */
function watch(page) {
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "";
    // `ferrite dev`'s live-reload stream and the desktop's live streams (`/live/`: the person's
    // notifications), closed by a reload or at the end of the run (as app-journey.mjs allows).
    if (
      (request.url().includes("/__forge/reload") ||
        new globalThis.URL(request.url()).pathname.startsWith("/live/")) &&
      ABORTED.test(error)
    )
      return;
    // An episode's audio stream from its publisher, cancelled by a reload or a new episode, or by
    // Firefox once it has the bytes in its cache (NS_ERROR_PARSED_DATA_CACHED).
    // WebKit does not type it as media: an audio file's address says what it is.
    const audio =
      request.resourceType() === "media" ||
      /\.(mp3|m4a|aac|mp4|ogg|oga|opus|wav)(\?|$)/i.test(
        new globalThis.URL(request.url()).pathname,
      );
    if (audio && (ABORTED.test(error) || error === "NS_ERROR_PARSED_DATA_CACHED")) return;
    // A show's cover from another origin (Apple's image CDN), cancelled by the browser when the
    // card that showed it goes (a search typed over the chart, a reload): noted, not a failure. A
    // cover that answers an HTTP error, or fails any other way, still fails the run.
    const coverCancelled =
      request.resourceType() === "image" &&
      new globalThis.URL(request.url()).origin !== new globalThis.URL(base).origin &&
      ABORTED.test(error);
    // In order with the steps, so that a failure is placed: which request, and when.
    console.log(
      `note: ${request.resourceType()} request ${coverCancelled ? "cancelled" : "failed"}: ${request.url().slice(0, 120)} ${error}`,
    );
    if (coverCancelled) return;
    problems.push(`request failed: ${request.url()} ${error}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
}

const pathOf = (response) => new globalThis.URL(response.url()).pathname;

/** The next answered request to `pathname` (and `method`) whose body passes `accept`. */
const next = (page, pathname, { method = "GET", accept = () => true, timeout = 20_000 } = {}) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      pathOf(response) === pathname &&
      accept(JSON.parse(response.request().postData() ?? "null")?.library),
    { timeout },
  );

async function openWithSpotlight(page, name) {
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const field = page.getByRole("combobox", { name: "Spotlight Search" });
  await field.fill(name);
  await field.press("Enter");
}

async function open(page) {
  await openWithSpotlight(page, "Podcasts");
  const window = page.getByRole("region", { name: "Podcasts", exact: true }).first();
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

const place = (window, name) =>
  window.getByRole("tree", { name: "Podcasts" }).getByRole("treeitem", { name }).first();

/** Choose `item` in the menu bar's menu `title` (the front application's). */
async function menu(page, title, item) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: title, exact: true })
    .click();
  await page.getByRole("menuitem", { name: item, exact: true }).click({ timeout: 5_000 });
}

/** Podcasts' Preferences, opened with Control-comma from the window. */
async function preferences(page, window) {
  await window.getByRole("searchbox").focus();
  await page.keyboard.press("Control+Comma");
  const prefs = page.locator(".mac-podcasts-preferences").first();
  await prefs.waitFor({ state: "visible", timeout: 10_000 });
  await prefs.getByRole("tab", { name: "Playback" }).click();
  return prefs;
}

/** Feed hosts tried first for the Top Charts step: their feeds answered every sampled read. */
const STEADY_HOSTS = ["feeds.npr.org", "feeds.simplecast.com", "feeds.megaphone.fm"];

/**
 * Top Charts: a show whose page is opened before Apple's lookup has given its feed reads its
 * episodes once the lookup answers. The lookup's reply is fetched from the server and held until
 * the page is open, so the order does not depend on timing.
 */
async function chartShowOpenedBeforeItsLookup(page, window) {
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let read = () => {};
  let failed = () => {};
  const lookedUp = new Promise((resolve, reject) => {
    read = resolve;
    failed = reject;
  });
  // Nothing waits on a lookup that is never answered: an unhandled rejection would end the run.
  lookedUp.catch(() => {});
  const pattern = "**/api/podcasts/lookup?*";
  await page.route(pattern, async (route) => {
    let response;
    try {
      response = await route.fetch();
      read(await response.json());
    } catch (error) {
      failed(new Error(`Apple's lookup could not be read: ${error?.message ?? error}`));
      await route.abort("failed").catch(() => {});
      return;
    }
    await held;
    await route.fulfill({ response });
  });
  try {
    const charted = next(page, "/api/podcasts/top", { timeout: 30_000 });
    await place(window, "Top Charts").click();
    const chart = (await (await charted).json()).shows ?? [];
    // Bounded like the chart: a lookup that is never asked for, or fails, ends the step.
    let timer;
    const listings =
      (
        await Promise.race([
          lookedUp,
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("the desktop asked Apple's lookup for nothing in 30 s")),
              30_000,
            );
          }),
        ]).finally(() => clearTimeout(timer))
      ).results ?? [];
    const followable = chart
      .map((show) => ({ show, listing: listings.find((each) => each.id === show.id) }))
      // Not the show the rest of the journey reads: its feed must not be read yet.
      .filter(({ show, listing }) => show.id !== SHOW_ID && listing?.followable && listing.feed);
    const hostOf = ({ listing }) => new globalThis.URL(listing.feed).host;
    const chosen =
      followable.find((entry) => STEADY_HOSTS.includes(hostOf(entry))) ?? followable[0];
    if (!chosen) {
      step("Top Charts lists a show this desktop can follow", false, `${chart.length} shows`);
      return;
    }
    await window.getByRole("button", { name: `Open ${chosen.show.title}`, exact: true }).click();
    const waiting = await window
      .getByText("Its feed is still being looked up.")
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      );
    const fed = next(page, "/api/podcasts/feed", { timeout: 30_000 });
    release();
    const feed = await fed;
    const asked = new globalThis.URL(feed.url()).searchParams.get("url");
    const episodes = (await feed.json()).feed?.episodes ?? [];
    await window
      .getByRole("region", { name: "Episodes" })
      .getByRole("button", { name: /^Play / })
      .first()
      .waitFor({ timeout: 10_000 });
    step(
      "a chart show opened before its feed was looked up lists its episodes once it is",
      waiting &&
        asked === chosen.listing.feed &&
        feed.status() === 200 &&
        episodes.length > 0 &&
        (await window.getByText("Reading the show's episodes…").count()) === 0,
      `${chosen.show.title}, ${hostOf(chosen)}, ${episodes.length} episodes`,
    );
  } finally {
    release();
    await page.unroute(pattern);
  }
}

/** The audio element's state. */
const audio = (page) =>
  page.evaluate(() => {
    const element = document.querySelector("audio.mac-podcasts-audio");
    return element
      ? {
          time: element.currentTime,
          paused: element.paused,
          rate: element.playbackRate,
          src: element.currentSrc || element.src,
          sameOrigin:
            new URL(element.currentSrc || element.src, location.href).origin === location.origin,
          error: element.error?.code ?? null,
        }
      : null;
  });

/** Read the library from the server until `accept` passes (a save may still be on its way). */
async function stored(page, accept, tries = 30) {
  let last = null;
  for (let n = 0; n < tries; n += 1) {
    last = await api(page, "GET", URL_LIBRARY);
    if (accept(last.json.library)) return last;
    await page.waitForTimeout(500);
  }
  return last;
}

async function journey(page, browser) {
  await openDesktop(page, base, step);
  // Its own guest, from a browser of its own: nothing of anyone's is here for the last step to clear.
  const starting = await api(page, "GET", URL_LIBRARY);
  if ((starting.json.shows ?? []).length > 0)
    throw new Error("This journey clears its library, and this one already holds shows.");

  let window = await open(page);
  step("Podcasts opens from Spotlight", await window.isVisible());

  await chartShowOpenedBeforeItsLookup(page, window);

  // Apple's directory, through the desktop's server.
  const searched = next(page, "/api/podcasts/search");
  await window.getByRole("searchbox").fill("Up First");
  const search = await searched;
  const found = (await search.json()).results ?? [];
  const listing = found.find((show) => show.id === SHOW_ID);
  step(
    "Apple's search finds the show, on a host this desktop can read",
    search.status() === 200 && listing?.followable === true,
    listing?.feed,
  );
  const card = window
    .getByRole("region", { name: "Shows" })
    .getByRole("button", { name: new RegExp(`^${SHOW}`) })
    .first();
  await card.waitFor({ timeout: 10_000 });

  // Its real episodes, read from its feed.
  const fed = next(page, "/api/podcasts/feed", { timeout: 30_000 });
  await card.click();
  const feed = await fed;
  const episodes = (await feed.json()).feed?.episodes ?? [];
  step(
    "the show's feed is read and its episodes listed",
    feed.status() === 200 && episodes.length > 1,
    `${episodes.length} episodes, newest "${episodes[0]?.title}"`,
  );
  const list = window.getByRole("region", { name: "Episodes" });
  const plays = list.getByRole("button", { name: /^Play / });
  await plays.first().waitFor({ timeout: 10_000 });
  const firstTitle = (await plays.nth(0).getAttribute("aria-label")).slice("Play ".length);
  const secondTitle = (await plays.nth(1).getAttribute("aria-label")).slice("Play ".length);
  step("the episodes are the feed's", firstTitle === episodes[0]?.title, firstTitle);

  const followed = next(page, URL_LIBRARY, {
    method: "PUT",
    accept: (library) => library?.shows?.some((show) => show.id === SHOW_ID),
  });
  await window.getByRole("button", { name: "Subscribe", exact: true }).click();
  step("following the show is saved", (await followed).status() === 200);

  // The browser plays the episode straight from its publisher.
  await plays.nth(0).click();
  await page.waitForFunction(
    () => {
      const element = document.querySelector("audio.mac-podcasts-audio");
      return element && !element.paused && element.currentTime > 2;
    },
    null,
    { timeout: 60_000 },
  );
  let state = await audio(page);
  step(
    "the episode plays: the audio element's position advances",
    state.time > 2,
    `${state.time.toFixed(1)} s`,
  );
  step(
    "its audio comes from the publisher, not the desktop's server",
    !state.sameOrigin,
    new globalThis.URL(state.src).host,
  );

  // Speed 1.5x, kept for the person.
  const fast = next(page, URL_LIBRARY, {
    method: "PUT",
    accept: (library) => library?.speed === 1.5,
  });
  await window.getByRole("button", { name: "Playback speed 1×" }).click();
  await window.getByRole("button", { name: "Playback speed 1.25×" }).click();
  await window.getByRole("button", { name: "Playback speed 1.5×" }).waitFor({ timeout: 5_000 });
  step(
    "the speed is set to 1.5x and saved",
    (await fast).status() === 200 && (await audio(page)).rate === 1.5,
  );

  // Pause.
  await window.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("audio.mac-podcasts-audio").paused,
    null,
    {
      timeout: 5_000,
    },
  );
  state = await audio(page);

  // Skip forward while paused: nothing but the Forward button can move the element now, and it
  // moves it by its seconds at once (a playing element would get there by itself).
  const forward = window.getByRole("button", { name: /^Forward \d+ seconds$/ });
  const by = Number(/\d+/.exec((await forward.getAttribute("aria-label")) ?? "")?.[0] ?? NaN);
  const before = (await audio(page)).time;
  await forward.click();
  const jumped = await page
    .waitForFunction(
      (target) => {
        const element = document.querySelector("audio.mac-podcasts-audio");
        return element.paused && Math.abs(element.currentTime - target) <= 1;
      },
      before + by,
      { timeout: 3_000 },
    )
    .then(
      () => true,
      () => false,
    );
  state = await audio(page);
  step(
    "skipping forward moves the paused audio by the Forward button's seconds",
    by > 0 && jumped && state.paused && Math.abs(state.time - (before + by)) <= 1,
    `${before.toFixed(1)} s to ${state.time.toFixed(1)} s, Forward ${by} seconds`,
  );

  // Up Next.
  const queued = next(page, URL_LIBRARY, {
    method: "PUT",
    accept: (library) => library?.queue?.some((item) => item.title === secondTitle),
  });
  await window.getByRole("button", { name: `Add ${secondTitle} to Up Next` }).click();
  step("queuing an episode in Up Next is saved", (await queued).status() === 200);

  // Preferences: Continuous Playback off, kept with the library.
  let prefs = await preferences(page, window);
  const continuousOff = next(page, URL_LIBRARY, {
    method: "PUT",
    accept: (library) => library?.settings?.continuous === false,
  });
  await prefs.getByRole("checkbox", { name: "Continuous Playback" }).click();
  step(
    "turning Continuous Playback off in Preferences is saved",
    (await continuousOff).status() === 200,
  );
  await prefs.getByRole("button", { name: "Close" }).first().click();

  const keptPlace = Math.floor(state.time);
  const all = await stored(
    page,
    (library) =>
      library?.queue?.length === 1 &&
      library?.speed === 1.5 &&
      Math.abs((library?.positions?.[library?.current?.id] ?? -9) - keptPlace) <= 1,
  );
  const library = all.json.library;
  const heldPlace = library?.positions?.[library?.current?.id];
  step(
    "the server holds the follow, the episode at the place it was paused and skipped to, Up Next, the speed and the setting",
    library?.shows?.[0]?.id === SHOW_ID &&
      library?.current?.title === firstTitle &&
      Math.abs((heldPlace ?? -9) - keptPlace) <= 1 &&
      library?.queue?.[0]?.title === secondTitle &&
      library?.speed === 1.5 &&
      library?.settings?.continuous === false,
    `rev ${all.json.rev}, place ${heldPlace} s, element at ${state.time.toFixed(1)} s`,
  );

  // After a reload: everything is back.
  await reloadDesktop(page);
  window = await open(page);
  const display = window.getByRole("group", { name: "Now Playing" });
  await display.waitFor({ timeout: 10_000 });
  step(
    "after a reload, the episode is loaded in the player",
    ((await display.textContent()) ?? "").includes(firstTitle),
  );
  // The menu bar's Controls: Play goes on from the place kept.
  await menu(page, "Controls", "Play");
  const resumed = await page
    .waitForFunction(
      (from) => {
        const element = document.querySelector("audio.mac-podcasts-audio");
        return (
          element !== null &&
          !element.paused &&
          element.currentTime >= from - 1 &&
          element.currentTime < from + 30
        );
      },
      heldPlace ?? keptPlace,
      { timeout: 30_000 },
    )
    .then(
      () => true,
      () => false,
    );
  state = await audio(page);
  step(
    "after a reload, Controls > Play plays the episode on from the place kept",
    resumed,
    `kept ${heldPlace} s, element at ${state.time.toFixed(1)} s`,
  );
  await menu(page, "Controls", "Pause");
  const pausedByMenu = await page
    .waitForFunction(() => document.querySelector("audio.mac-podcasts-audio").paused, null, {
      timeout: 5_000,
    })
    .then(
      () => true,
      () => false,
    );
  step("Controls > Pause pauses the audio element", pausedByMenu);
  const from = (await audio(page)).time;
  await menu(page, "Controls", `Skip Forward ${by} Seconds`);
  const skippedByMenu = await page
    .waitForFunction(
      (target) => {
        const element = document.querySelector("audio.mac-podcasts-audio");
        return element.paused && Math.abs(element.currentTime - target) <= 1;
      },
      from + by,
      { timeout: 3_000 },
    )
    .then(
      () => true,
      () => false,
    );
  const afterSkip = (await audio(page)).time;
  step(
    "Controls > Skip Forward moves the paused audio element by its seconds",
    skippedByMenu,
    `${from.toFixed(1)} s to ${afterSkip.toFixed(1)} s`,
  );
  step(
    "after a reload, the speed is 1.5x",
    (await window.getByRole("button", { name: "Playback speed 1.5×" }).count()) === 1 &&
      state.rate === 1.5,
  );
  prefs = await preferences(page, window);
  const continuousShown = await prefs
    .getByRole("checkbox", { name: "Continuous Playback" })
    .isChecked();
  await prefs.getByRole("button", { name: "Close" }).first().click();
  step("after a reload, Preferences show Continuous Playback off", continuousShown === false);
  await window.getByRole("button", { name: "Up Next", exact: true }).click();
  const queuePanel = window.getByRole("region", { name: "Queue" });
  await queuePanel
    .getByText(secondTitle)
    .first()
    .waitFor({ timeout: 5_000 })
    .catch(() => {});
  step(
    "after a reload, Up Next holds the queued episode",
    (await queuePanel.getByText(secondTitle).count()) >= 1,
  );
  await window.getByRole("button", { name: "Up Next", exact: true }).click();
  await place(window, "Shows").click();
  const shows = await window
    .locator(".mac-card-grid-card-title")
    .evaluateAll((titles) => titles.map((title) => title.textContent));
  step("after a reload, the show is among the followed shows", shows.includes(SHOW));
  await shot(page, path.join(out, `podcasts-${browserName}.png`));

  // Another person (a guest of another browser) has none of it: no show followed, no episode
  // loaded, played or started, nothing in Up Next and the normal speed, in the library the server
  // keeps for them and in their Podcasts window.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const other = await context.newPage();
  watch(other);
  await openDesktop(other, base, step);
  const theirs = await api(other, "GET", URL_LIBRARY);
  const their = theirs.json.library;
  const empty = (value) =>
    value === undefined ||
    value === null ||
    (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0);
  step(
    "another browser's person has no show, episode, place, Up Next or setting, and the normal speed",
    theirs.status === 200 &&
      (their === null ||
        (empty(their.shows) &&
          empty(their.subscribed) &&
          (their.current ?? null) === null &&
          empty(their.positions) &&
          empty(their.played) &&
          empty(their.queue) &&
          (their.settings?.continuous ?? true) === true &&
          (their.speed ?? 1) === 1)),
    their === null ? "no library" : JSON.stringify(their).slice(0, 200),
  );
  const theirWindow = await open(other);
  const theirDisplay = theirWindow.getByRole("group", { name: "Now Playing" });
  const theirLoaded =
    (await theirDisplay.count()) > 0 ? ((await theirDisplay.textContent()) ?? "") : "";
  const theirUpNext = await theirWindow
    .getByRole("button", { name: `${secondTitle}, ${SHOW}` })
    .count();
  await place(theirWindow, "Shows").click();
  const theirShows = await theirWindow
    .locator(".mac-card-grid-card-title")
    .evaluateAll((titles) => titles.map((title) => title.textContent));
  step(
    "another browser's Podcasts window shows none of it",
    !theirLoaded.includes(firstTitle) &&
      theirUpNext === 0 &&
      !theirShows.includes(SHOW) &&
      (await theirWindow.getByRole("button", { name: "Playback speed 1×" }).count()) === 1,
    `${theirShows.length} shows`,
  );
  await context.close();

  await api(page, "DELETE", URL_LIBRARY);
}

console.log(`podcasts in ${browserName}`);
const browser = await ENGINES[browserName].launch(launchOptions[engineFamily(browserName)] ?? {});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const page = await context.newPage();
  watch(page);
  await journey(page, browser);
  await context.close();
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(
    `\npodcasts: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\npodcasts: all ${steps.length} steps passed with no console errors`);

#!/usr/bin/env node
// TV's rows of the inventory that no other journey pictured: the places, a video's page, Up Next and
// Continue Watching, the search of the library, a pasted link, the player, Clear History, Preferences
// by key, the search field by key, what is kept across a reload, and File > Library. YouTube's player
// is real, so where YouTube refuses this network the journey reads TV's own words and follows Watch
// on YouTube. Play, Pause and the skips are run on a real movie uploaded to the drive, as a home
// video, since it plays here whatever YouTube does. Continue Watching's place is written through the
// library's API, because a place in a YouTube video cannot be earned here.
//
//   node e2e/tv-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-rows", {
  ignoreOtherOrigins: true,
  launchOptions: { chromium: { args: ["--autoplay-policy=no-user-gesture-required"] } },
});

const LIBRARY = "/api/tv/library";
const PREFERENCES = "/api/tv/preferences";
const BUNNY = "aqz-KE-bpKQ";
const BUNNY_LINK = `https://www.youtube.com/watch?v=${BUNNY}`;
const BUNNY_NAME = /Big Buck Bunny/;
const SERVER = 60_000;
const MOVIE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures/test-pattern.webm");
const MOVIE_NAME = `Rows ${Date.now().toString(36)}`;

const read = async (page) => (await api(page, "GET", LIBRARY)).json?.library ?? null;
const shelf = (window, name) => window.getByRole("region", { name, exact: true });
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

async function openTv(page) {
  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: SERVER });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: SERVER },
  );
  return window;
}

/** A movie put in the drive's Movies folder, as an upload from the computer does. */
const upload = (page, name, base64) =>
  page.evaluate(
    async ({ name, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const json = { "content-type": "application/json" };
      const started = await fetch("/api/files/uploads", {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: JSON.stringify({
          parent: "movies",
          name,
          size: bytes.length,
          type: "video/webm",
          existing: "fail",
        }),
      }).then((reply) => reply.json());
      for (let index = 0; index < started.pieces; index += 1) {
        await fetch(`/api/files/uploads/${started.upload}/${index}`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream" },
          body: bytes.slice(index * started.piece_bytes, (index + 1) * started.piece_bytes),
        });
      }
      const done = await fetch(`/api/files/uploads/${started.upload}/complete`, {
        method: "POST",
        credentials: "same-origin",
        headers: json,
        body: "{}",
      }).then((reply) => reply.json());
      return done.created[0];
    },
    { name, base64 },
  );

/** A file of the Downloads folder by name, with its text as the drive serves it. */
async function downloaded(page, name) {
  const entries = (await api(page, "GET", "/api/files/")).json?.entries ?? [];
  const entry = entries.find((each) => each.parent === "downloads" && each.name === name);
  if (!entry) return null;
  return page.evaluate(
    (id) => fetch(`/api/files/content/${id}`, { credentials: "same-origin" }).then((r) => r.text()),
    entry.id,
  );
}

async function places(page, window) {
  const section = (name) => window.getByRole("button", { name, exact: true });
  await shelf(window, "Open Movies").waitFor({ timeout: SERVER });
  step(
    "Watch Now shows the open films and the shelf for everyone",
    (await shelf(window, "For Everyone").locator(".mac-card-grid-card").count()) > 0,
  );
  await settled(page, "tv-rows-watch-now.png");

  await section("Movies").click();
  const movies = await shelf(window, "Open Movies").locator(".mac-card-grid-card").allInnerTexts();
  step(
    "Movies lists the open films",
    movies.some((text) => /Sintel/.test(text)),
    movies.join(" | "),
  );
  await settled(page, "tv-rows-movies.png");

  await section("Kids").click();
  const kids = await shelf(window, "Kids").locator(".mac-card-grid-card").allInnerTexts();
  step(
    "Kids lists its films",
    kids.some((text) => BUNNY_NAME.test(text)),
    kids.join(" | "),
  );
  await settled(page, "tv-rows-kids.png");

  // ---- A video's page, and Controls' rows on it ------------------------------------------------
  await shelf(window, "Kids").getByRole("button", { name: BUNNY_NAME }).first().click();
  const addUpNext = window.getByRole("button", { name: "Add to Up Next" });
  await addUpNext.waitFor({ timeout: 5_000 });
  step(
    "A video's page has Play, Up Next, Watch Later and Share",
    (await window.getByRole("button", { name: "Play", exact: true }).count()) === 1 &&
      (await window.getByRole("button", { name: "Add to Watch Later" }).count()) === 1 &&
      (await window.getByRole("button", { name: "Share", exact: true }).count()) === 1,
  );
  await settled(page, "tv-rows-video-page.png");

  await chooseMenu(page, "Controls", "Add to Up Next");
  step(
    "Controls > Add to Up Next queues the video shown, on the server",
    await until(async () => (await read(page))?.upNext?.includes(BUNNY), SERVER),
  );
  await chooseMenu(page, "Controls", "Remove from Up Next");
  step(
    "Controls > Remove from Up Next takes it out again",
    await until(async () => !(await read(page))?.upNext?.includes(BUNNY), SERVER),
  );
  await chooseMenu(page, "Controls", "Add to Watch Later");
  step(
    "Controls > Add to Watch Later keeps the video shown, on the server",
    await until(async () => (await read(page))?.watchLater?.includes(BUNNY), SERVER),
  );
  await chooseMenu(page, "Controls", "Remove from Watch Later");
  step(
    "Controls > Remove from Watch Later takes it out again",
    await until(async () => !(await read(page))?.watchLater?.includes(BUNNY), SERVER),
  );
  await addUpNext.click();
  await window.getByRole("button", { name: "Add to Watch Later" }).click();
  await until(async () => {
    const library = await read(page);
    return library?.upNext?.includes(BUNNY) && library?.watchLater?.includes(BUNNY);
  }, SERVER);

  await section("Watch Now").click();
  await shelf(window, "Up Next").waitFor({ timeout: 5_000 });
  step(
    "Up Next's shelf shows what is queued, above the films",
    (await shelf(window, "Up Next").locator(".mac-card-grid-card").count()) === 1 &&
      BUNNY_NAME.test(await shelf(window, "Up Next").innerText()),
  );
  await settled(page, "tv-rows-up-next.png");
}

async function youtube(page, window) {
  // ---- A pasted link -----------------------------------------------------------------------------
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.fill(BUNNY_LINK);
  const pasted = shelf(window, "YouTube Link");
  await pasted.getByText(BUNNY_NAME).first().waitFor({ timeout: SERVER });
  step("A pasted link shows YouTube's own title, through the server", true);
  await settled(page, "tv-rows-pasted-link.png");

  // ---- The player -------------------------------------------------------------------------------
  await field.press("Enter");
  const player = window.locator("section.mac-tv-player");
  await player.waitFor({ timeout: SERVER });
  const frame = player.locator(`iframe[src*="youtube-nocookie.com/embed/${BUNNY}"]`);
  await frame.waitFor({ state: "attached", timeout: SERVER });
  step("Return plays the link in YouTube's official embed", true);
  step(
    "and puts it first in History, on the server",
    await until(async () => (await read(page))?.history?.[0]?.id === BUNNY, SERVER),
  );
  const outcome = await page
    .waitForFunction(
      (element) =>
        element.hasAttribute("data-error")
          ? `error ${element.getAttribute("data-error")}`
          : element.dataset.state === "playing"
            ? "playing"
            : null,
      await player.elementHandle(),
      { timeout: 45_000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => "neither");
  await settled(page, "tv-rows-player.png");
  console.log(`note: YouTube's player: ${outcome}`);
  step("YouTube's player plays, or TV says why not", outcome !== "neither", outcome);

  if (outcome.startsWith("error ")) {
    const said = await player.getByRole("alert").innerText();
    step(
      "TV shows YouTube's refusal in its own words",
      /will not play this video here/.test(said),
      said.replace(/\s+/g, " ").slice(0, 160),
    );
    const play = await menuItemState(page, "Controls", "Play");
    const back = await menuItemState(page, "Controls", "Skip Back 10 Seconds");
    step(
      "Controls' Play and skips are dimmed while YouTube refuses",
      play.disabled && back.disabled,
    );
    const opening = page.context().waitForEvent("page", { timeout: SERVER });
    await player.getByRole("button", { name: "Watch on YouTube" }).click();
    const tab = await opening;
    await tab.waitForURL(/youtube\.com\/watch\?v=/, { timeout: SERVER }).catch(() => {});
    step(
      "Watch on YouTube opens the video in a tab of the browser",
      tab.url().includes(`watch?v=${BUNNY}`),
      tab.url().slice(0, 90),
    );
    await tab.close();
  }
  await player.getByRole("button", { name: "Done" }).click();
  await window
    .getByRole("button", { name: "Add to Watch Later" })
    .or(window.getByRole("button", { name: "Remove from Watch Later" }))
    .first()
    .waitFor({ timeout: 5_000 });
  step("Done goes back to the video's page", true);
  await field.fill("");
}

async function homeVideo(page) {
  const name = `${MOVIE_NAME}.webm`;
  const made = await upload(page, name, readFileSync(MOVIE).toString("base64"));
  await quiet();
  await reloadDesktop(page);
  const again = await openTv(page);
  await chooseMenu(page, "File", "Import…");
  const panel = page.locator(".mac-tv-panel-layer");
  await panel.waitFor({ timeout: SERVER });
  await panel.getByText(name, { exact: true }).first().click({ timeout: SERVER });
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  const card = again.locator(".mac-card-grid-card", { hasText: MOVIE_NAME }).first();
  await card.waitFor({ timeout: SERVER });
  await card.click();
  const video = again.locator(".mac-tv-player-video video");
  await video.waitFor({ timeout: SERVER });
  const value = (property) => video.evaluate((element, key) => element[key], property);
  const time = () => value("currentTime");
  // Past the first second: a video stopped earlier is at its start, and keeps no place to resume from.
  await until(async () => (await time()) > 1.5, SERVER);

  await chooseMenu(page, "Controls", "Pause");
  step("Controls > Pause pauses the movie", await until(() => value("paused"), 5_000));
  await chooseMenu(page, "Controls", "Play");
  step("Controls > Play plays it on", await until(async () => !(await value("paused")), 5_000));
  await chooseMenu(page, "Controls", "Pause");
  await until(() => value("paused"), 5_000);
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "Controls", exact: true })
    .click();
  await settled(page, "tv-rows-controls.png");
  await closeMenus(page);

  await chooseMenu(page, "Controls", "Stop");
  await card.waitFor({ timeout: SERVER });
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Play from Beginning" }).click();
  await video.waitFor({ timeout: SERVER });
  await until(async () => (await time()) > 1.5, SERVER);
  await chooseMenu(page, "Controls", "Pause");
  await until(() => value("paused"), 5_000);
  const from = await time();
  await chooseMenu(page, "Controls", "Skip Forward 10 Seconds");
  step(
    "Controls > Skip Forward moves the paused movie on ten seconds",
    await until(async () => Math.abs((await time()) - from - 10) < 1.5, 5_000),
    `${from} to ${await time()}`,
  );
  const on = await time();
  await chooseMenu(page, "Controls", "Skip Back 10 Seconds");
  step(
    "Controls > Skip Back moves it back ten seconds",
    await until(async () => Math.abs(on - (await time()) - 10) < 1.5, 5_000),
    `${on} to ${await time()}`,
  );
  const stopAt = Math.floor(await time());
  await chooseMenu(page, "Controls", "Stop");
  step(
    "The place in a video is kept on the server",
    await until(
      async () => (await read(page))?.homeVideos?.find((one) => one.id === made)?.place === stopAt,
      SERVER,
    ),
    JSON.stringify((await read(page))?.homeVideos),
  );
  return made;
}

async function search(page, window) {
  const field = window.getByRole("searchbox", { name: "Search" });
  await field.fill("bunny");
  const mine = shelf(window, "In Your Library");
  await mine.waitFor({ timeout: 5_000 });
  step("Search finds a video in the library", BUNNY_NAME.test(await mine.innerText()));
  await settled(page, "tv-rows-search.png");
  await field.fill(MOVIE_NAME.toLowerCase());
  await shelf(window, "Home Videos").waitFor({ timeout: 5_000 });
  step(
    "and a home video by the file's name",
    (await shelf(window, "Home Videos").innerText()).includes(MOVIE_NAME),
  );
  await field.fill("");
}

async function keys(page, window) {
  await window.getByRole("heading").first().click();
  await page.keyboard.press("ControlOrMeta+f");
  step(
    "⌘F gives the search field the keyboard",
    await until(
      () =>
        window
          .locator('input[type="search"]')
          .evaluate((field) => document.activeElement === field),
      5_000,
    ),
  );
  await page.keyboard.press("ControlOrMeta+,");
  const general = page.getByRole("dialog", { name: "General" });
  await general.waitFor({ timeout: 5_000 });
  step("⌘, opens Preferences", true);
  await settled(page, "tv-rows-preferences.png");

  await general.getByRole("combobox", { name: "List Size:" }).click();
  await page.getByRole("option", { name: "Large" }).click();
  await general.getByRole("button", { name: "OK" }).click();
  step(
    "List Size Large is kept on the server",
    await until(
      async () => (await api(page, "GET", PREFERENCES)).json?.preferences?.listSize === "large",
      SERVER,
    ),
  );
}

async function fileLibrary(page, window) {
  // ---- File > Library ----------------------------------------------------------------------------
  const organize = await menuItemState(page, "File", "Library", "Organize Library…");
  step(
    "File > Library > Organize Library is dimmed, saying why",
    organize.disabled && /drive/.test(organize.title ?? ""),
    organize.title ?? "",
  );
  const none = await menuItemState(page, "File", "Library", "Export Playlist");
  step("Export Playlist is dimmed while there is no playlist", none.disabled, none.title ?? "");

  await chooseMenu(page, "File", "New Playlist…");
  const sheet = page.getByRole("dialog", { name: "New Playlist" });
  await sheet.getByRole("textbox").fill("Rows");
  await sheet.getByRole("button", { name: "Create" }).click();
  await until(async () => (await read(page))?.playlists?.length === 1, SERVER);
  const list = (await read(page)).playlists[0].id;
  const history = shelf(window, "History");
  await history.waitFor({ timeout: SERVER });
  await history.locator(".mac-card-grid-card").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Playlist" }).hover();
  await page.getByRole("menuitem", { name: "Rows", exact: true }).click();
  await until(async () => (await read(page))?.playlists?.[0]?.videos?.includes(BUNNY), SERVER);

  await chooseMenu(page, "File", "Library", "Export Library…");
  const xml = await (async () => {
    let text = null;
    await until(async () => {
      text = await downloaded(page, "TV Library.xml");
      return text !== null;
    }, SERVER);
    return text;
  })();
  step(
    "Export Library writes TV Library.xml in Downloads, with the lists in it",
    xml?.includes("<key>Playlists</key>") &&
      xml.includes("<string>Rows</string>") &&
      xml.includes(MOVIE_NAME) &&
      xml.includes(`watch?v=${BUNNY}`),
    (xml ?? "").slice(0, 80),
  );

  await chooseMenu(page, "File", "Library", "Export Playlist", "Rows");
  let m3u = null;
  await until(async () => {
    m3u = await downloaded(page, "Rows.m3u");
    return m3u !== null;
  }, SERVER);
  step(
    "Export Playlist writes the playlist's links in Downloads",
    m3u?.startsWith("#EXTM3U") && m3u.includes(BUNNY_LINK),
    (m3u ?? "").replace(/\n/g, " / "),
  );

  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: "File", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Library", exact: true }).hover();
  await page.getByRole("menuitem", { name: "Export Library…" }).waitFor({ timeout: 5_000 });
  await settled(page, "tv-rows-file-library.png");
  await closeMenus(page);

  await chooseMenu(page, "File", "Library", "Import Playlist…");
  const panel = page.locator(".mac-tv-panel-layer");
  await panel.waitFor({ timeout: SERVER });
  await panel.getByText("Rows.m3u", { exact: true }).first().click({ timeout: SERVER });
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  step(
    "Import Playlist makes a playlist of the file's links",
    await until(async () => {
      const lists = (await read(page))?.playlists ?? [];
      return (
        lists.length === 2 && lists.some((one) => one.id !== list && one.videos.includes(BUNNY))
      );
    }, SERVER),
    JSON.stringify((await read(page))?.playlists),
  );
}

await run(async (page) => {
  followRequests(page);
  await openDesktop(page, base, step);
  let window = await openTv(page);
  await places(page, window);
  await youtube(page, window);
  await homeVideo(page);
  window = page.getByRole("region", { name: "TV", exact: true }).first();
  await search(page, window);
  await keys(page, window);
  await window.getByRole("button", { name: "Library", exact: true }).click();
  await fileLibrary(page, window);

  // ---- Continue Watching: a place written through the library's API, then a reload ----------------
  const held = (await api(page, "GET", LIBRARY)).json;
  await quiet();
  await api(page, "PUT", LIBRARY, {
    library: { ...held.library, positions: { ...held.library.positions, [BUNNY]: 600 } },
    rev: held.rev,
  });
  await quiet();
  await reloadDesktop(page);
  window = await openTv(page);
  await window.getByRole("button", { name: "Watch Now", exact: true }).click();
  const going = shelf(window, "Continue Watching");
  await going.waitFor({ timeout: SERVER });
  step(
    "With a seeded place, after a reload Continue Watching holds the video",
    BUNNY_NAME.test(await going.innerText()),
    (await going.innerText()).replace(/\s+/g, " ").slice(0, 100),
  );
  await settled(page, "tv-rows-continue-watching.png");
  await going.locator(".mac-card-grid-card").first().click({ button: "right" });
  const resume = page.getByRole("menuitem", { name: "Resume from 10:00" });
  await resume.waitFor({ timeout: 5_000 });
  step("With a seeded place, a video's card offers to resume from it", true);
  await closeMenus(page);
  step(
    "Up Next is back over the reload",
    BUNNY_NAME.test(await shelf(window, "Up Next").innerText()),
  );

  await window.getByRole("button", { name: "Library", exact: true }).click();
  const later = shelf(window, "Watch Later");
  const history = shelf(window, "History");
  await history.waitFor({ timeout: SERVER });
  const width = await later.evaluate((element) =>
    element.style.getPropertyValue("--mac-card-grid-min-card-width"),
  );
  const library = await read(page);
  step(
    "Watch Later and History are back, read from the server too",
    BUNNY_NAME.test(await later.innerText()) &&
      BUNNY_NAME.test(await history.innerText()) &&
      library.watchLater.includes(BUNNY) &&
      library.upNext.includes(BUNNY) &&
      library.history.some((entry) => entry.id === BUNNY),
  );
  step("List Size Large holds over the reload: the cards are that wide", width === "288px", width);
  const home = window.locator(".mac-card-grid-card", { hasText: MOVIE_NAME }).first();
  step("A home video says where it stopped", /Stopped at/.test(await home.innerText()));
  await settled(page, "tv-rows-library.png");

  // ---- Clear History ------------------------------------------------------------------------------
  await history.getByRole("button", { name: "Clear History" }).click();
  await history.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Clear History empties it on the server and takes its shelf away",
    await until(async () => (await read(page))?.history?.length === 0, SERVER),
  );
  await settled(page, "tv-rows-history-cleared.png");
  await quiet();
});

process.exit(0);

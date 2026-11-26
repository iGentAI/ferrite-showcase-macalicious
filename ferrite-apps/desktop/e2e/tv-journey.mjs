#!/usr/bin/env node
// TV and QuickTime Player on Ferrite.
//
// TV: paste a YouTube link, see YouTube's oEmbed title (looked up by the app through its
// `youtube` egress), add it to Watch Later and Up Next, play it in YouTube's embedded player under
// TV's controls, try YouTube search, then reload and find Watch Later, History and Up Next kept
// by /api/tv/library. Then the menu bar: Controls takes the video shown out of Watch Later and
// puts it back, and Play opens the player, whose Pause it drives (or, when YouTube refuses this
// network, Controls' Play and skips are dimmed, as are the player's own); TV > Preferences… shows
// the settings TV cannot carry out dimmed with their reasons, and List Size Large is kept by
// /api/tv/preferences across a reload (the Library's cards are that wide), and another browser's
// person has none of it.
//
// QuickTime Player: get it from the App Store, upload a movie from the computer into the drive's
// Movies folder, play it as read back from the drive, seek, change the volume, float it in
// Picture in Picture and fill the screen; reload, find it in Movies and Recents, open it again with
// the menu bar's File > Open Recent, and find it starting where it was left; File > Open File…
// goes back to the Open panel; another browser's person has no recents.
//
// Exits 0 only when every step passed and the desktop's own requests and the page's own console
// logged no error. YouTube's embedded player makes requests and logs messages of its own, which
// the app cannot control: those are listed for information and do not fail the run.
//
// YouTube refuses to play any video to some networks, data-centre addresses among them (player
// error 150, "Video unavailable"); a cloud sandbox cannot see frames play. With
// `--allow-youtube-refusal` that refusal, shown in TV's own words, passes the playback step and
// is logged as a refusal; without it, it fails the run.
//
//   ferrite dev --egress allow                        # in ferrite-apps/desktop
//   node e2e/tv-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                           [--browser chromium|chrome|firefox|webkit] [--allow-youtube-refusal]

import path from "node:path";
import { fileURLToPath } from "node:url";
import { api, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { ENGINES, engineFamily } from "./journey-kit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const MOVIE = path.join(here, "fixtures", "test-pattern.webm");
const MOVIE_NAME = "test-pattern.webm";
const VIDEO = "aqz-KE-bpKQ";
const LINK = `https://www.youtube.com/watch?v=${VIDEO}`;
const TV = "/api/tv/library";
const TV_PREFERENCES = "/api/tv/preferences";
const RECENTS = "/api/quicktime-player/recents";
const STORE = "/api/app-store/library";
const DRIVE = "/api/files/";

const { base, out, browserName } = options();
const allowRefusal = process.argv.includes("--allow-youtube-refusal");
const origin = new URL(base).origin;
// Videos start without a click into YouTube's frame: the person's click is on TV's own button.
const launchOptions = {
  chromium: { args: ["--autoplay-policy=no-user-gesture-required"] },
  firefox: { firefoxUserPrefs: { "media.autoplay.default": 0 } },
  webkit: {},
};

const problems = [];
const notes = [];
let steps = 0;
// Once the steps are done, the journey cleans up and closes the browser: what that cuts off (the
// desktop's own loads, a page's last saves) is not a failure of the app.
let tearingDown = false;
const step = (label, ok, detail = "") => {
  steps += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(label);
  return ok;
};
const ours = (url) => {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
};
function watch(page) {
  page.on("console", (message) => {
    if (tearingDown || message.type() !== "error") return;
    const where = message.location()?.url ?? "";
    if (where && !ours(where)) notes.push(`third-party console: ${message.text().slice(0, 160)}`);
    else problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    if (!tearingDown) problems.push(`page error: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    if (tearingDown) return;
    const url = request.url();
    const reason = request.failure()?.errorText ?? "";
    // The dev server's reload stream and the desktop's own live stream (`/live/`) are cut by every
    // reload: a long-lived request the page let go of, not a failure.
    if (
      (url.includes("/__forge/reload") || new URL(url).pathname.startsWith("/live/")) &&
      /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(reason)
    )
      return;
    // A blob: movie the page let go of when the window closed is not a failure of the app.
    if (url.startsWith("blob:") && /ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(reason)) return;
    if (ours(url)) problems.push(`request failed: ${url} ${reason}`);
    else notes.push(`third-party request failed: ${url.slice(0, 120)} ${reason}`);
  });
  page.on("response", (response) => {
    if (tearingDown || response.status() < 400) return;
    if (ours(response.url())) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    else notes.push(`third-party HTTP ${response.status()}: ${response.url().slice(0, 120)}`);
  });
}

const nextPut = (page, url, accept) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === url &&
      accept(JSON.parse(response.request().postData() ?? "null")),
    { timeout: 15_000 },
  );

async function openFromDock(page, name, role, windowName) {
  await page
    .locator(".mac-dock")
    .getByRole("button", { name: new RegExp(`^${name}$`) })
    .click();
  const window = page.getByRole(role, { name: windowName, exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    {
      timeout: 15_000,
    },
  );
  return window;
}

async function tv(page) {
  let window = await openFromDock(page, "TV", "region", "TV");
  step("TV opens from the Dock with its library read", await window.isVisible());

  const field = window.getByRole("searchbox", { name: "Search" });
  await field.fill(LINK);
  const card = window
    .getByRole("region", { name: "YouTube Link" })
    .locator(".mac-card-grid-card-title");
  await card.filter({ hasText: "Big Buck Bunny" }).waitFor({ timeout: 15_000 });
  const title = (await card.textContent()) ?? "";
  step(
    "a pasted YouTube link shows YouTube's own title (oEmbed through the app)",
    /Big Buck Bunny/.test(title),
    title,
  );

  let saved = nextPut(page, TV, (body) => body?.library?.watchLater?.includes(VIDEO));
  await window.getByRole("button", { name: "Add to Watch Later" }).click();
  step("Add to Watch Later is saved through PUT /api/tv/library", (await saved).status() === 200);
  saved = nextPut(page, TV, (body) => body?.library?.upNext?.includes(VIDEO));
  await window.getByRole("button", { name: "Add to Up Next" }).click();
  step("Add to Up Next is saved", (await saved).status() === 200);

  saved = nextPut(page, TV, (body) => body?.library?.history?.[0]?.id === VIDEO);
  await field.press("Enter");
  const player = window.locator("section.mac-tv-player");
  await player.waitFor({ timeout: 15_000 });
  step(
    "Return plays the link in TV's player and puts it first in History",
    (await saved).status() === 200,
  );
  const frame = player.locator(`iframe[src*="youtube-nocookie.com/embed/${VIDEO}"]`);
  await frame.waitFor({ state: "attached", timeout: 20_000 });
  step(
    "the player is YouTube's official embed (youtube-nocookie.com, IFrame Player API)",
    (await frame.count()) === 1,
  );

  // Ready, then playing (its time moves) or refused (TV's message).
  await page.waitForFunction(
    (element) => element.dataset.state !== "loading" || element.hasAttribute("data-error"),
    await player.elementHandle(),
    { timeout: 30_000 },
  );
  const outcome = await page
    .waitForFunction(
      (element) => {
        const code = element.getAttribute("data-error");
        if (code !== null) return `error ${code}`;
        const time = element.querySelector('[data-time="elapsed"]')?.textContent ?? "0:00";
        return time !== "0:00" && time !== "0:01" ? "playing" : null;
      },
      await player.elementHandle(),
      { timeout: 45_000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => "neither");
  const controls = player.getByRole("group", { name: "Playback controls" });
  if (outcome === "playing") {
    step("the YouTube video plays: TV's controller follows its time", true);
    await controls.getByRole("button", { name: "Pause", exact: true }).click();
    await page.waitForFunction(
      (element) => element.dataset.state === "paused",
      await player.elementHandle(),
      {
        timeout: 10_000,
      },
    );
    step("Pause pauses YouTube's player", true);
  } else if (typeof outcome === "string" && outcome.startsWith("error ")) {
    // Only YouTube's refusal of the network itself (player error 150 or 101, the codes YouTube
    // gives a data-centre address) may stand in for playback, and only when asked to; any other
    // error (a wrong id, a private video, a player that would not load) fails the run.
    const code = outcome.slice("error ".length);
    const refusal = code === "150" || code === "101";
    const message = (await player.getByRole("alert").textContent()) ?? "";
    const named = /YouTube will not play this video here/.test(message);
    if (allowRefusal && refusal) {
      console.log(
        `NOTE YouTube refused to play to this network (player error ${code}): frames playing could not be seen here`,
      );
      notes.push(`YouTube refused playback to this network (player error ${code})`);
    }
    step(
      allowRefusal && refusal
        ? `YouTube refused this network (error ${code}); TV says so in its own words and offers Watch on YouTube`
        : "the YouTube video plays",
      allowRefusal &&
        refusal &&
        named &&
        (await player.getByRole("button", { name: "Watch on YouTube" }).count()) === 1,
      `player error ${code}: ${message.slice(0, 120)}`,
    );
  } else {
    step(
      "the YouTube video plays or YouTube says why not",
      false,
      "no time and no error within 45 s",
    );
  }
  const reported = (await player.getAttribute("aria-label")) ?? "";
  step("the player is named by the video's title", /Big Buck Bunny/.test(reported), reported);

  await controls.getByRole("button", { name: "Enter Full Screen" }).click();
  const full = await page
    .waitForFunction(
      () => document.fullscreenElement?.classList.contains("mac-tv-player") ?? false,
      null,
      {
        timeout: 5_000,
      },
    )
    .then(() => true)
    .catch(() => false);
  step("Enter Full Screen fills the screen with the player", full);
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());

  await player.getByRole("button", { name: "Done" }).click();
  await field.fill("llamas");
  const search = await window
    .getByRole("status")
    .filter({ hasText: /needs a YouTube Data API key/ })
    .or(window.getByRole("region", { name: "YouTube" }))
    .first()
    .waitFor({ timeout: 15_000 })
    .then(async () =>
      (await window.getByRole("region", { name: "YouTube" }).count()) > 0 ? "results" : "no key",
    )
    .catch(() => "nothing");
  step(
    "searching YouTube gives results, or says it needs a YouTube Data API key",
    search !== "nothing",
    search,
  );
  await field.fill("");

  await reloadDesktop(page);
  window = await openFromDock(page, "TV", "region", "TV");
  const upNext = await window
    .getByRole("region", { name: "Up Next" })
    .locator(".mac-card-grid-card-title")
    .allTextContents();
  step(
    "after a reload, Up Next holds the video",
    upNext.some((name) => /Big Buck Bunny/.test(name)),
    upNext.join(", "),
  );
  await window.getByRole("button", { name: "Library" }).click();
  const later = await window
    .getByRole("region", { name: "Watch Later" })
    .locator(".mac-card-grid-card-title")
    .allTextContents();
  const history = await window
    .getByRole("region", { name: "History" })
    .locator(".mac-card-grid-card-title")
    .allTextContents();
  step(
    "after a reload, Watch Later holds it",
    later.some((name) => /Big Buck Bunny/.test(name)),
  );
  step(
    "after a reload, History holds it",
    history.some((name) => /Big Buck Bunny/.test(name)),
  );
  const stored = await api(page, "GET", TV);
  step(
    "the server holds History, Watch Later and Up Next",
    stored.json.library?.history?.[0]?.id === VIDEO &&
      stored.json.library?.watchLater?.includes(VIDEO) &&
      stored.json.library?.upNext?.includes(VIDEO),
    `rev ${stored.json.rev}`,
  );
  await shot(page, path.join(out, `tv-${browserName}.png`));
  await window.getByRole("button", { name: "Close" }).first().click();
}

/** Open the menu bar's menu `title` (the front application's) and find its item `name`. */
async function menuItem(page, title, name) {
  await page
    .getByRole("menubar")
    .first()
    .getByRole("menuitem", { name: title, exact: true })
    .click();
  const item = page.getByRole("menuitem", { name, exact: true });
  await item.waitFor({ timeout: 5_000 });
  return item;
}
const dimmed = async (control) =>
  (await control.getAttribute("aria-disabled")) === "true" || (await control.isDisabled());

/** The menu bar's Controls menu, and TV's Preferences kept for the person. */
async function tvControlsAndPreferences(page) {
  let window = await openFromDock(page, "TV", "region", "TV");
  await window.getByRole("button", { name: "Watch Now" }).click();
  // Up Next's card opens the video's page: Controls acts on the video shown.
  await window
    .getByRole("region", { name: "Up Next" })
    .getByRole("button")
    .filter({ hasText: "Big Buck Bunny" })
    .first()
    .click();
  await window
    .getByRole("button", { name: "Remove from Watch Later" })
    .waitFor({ timeout: 10_000 });
  let saved = nextPut(
    page,
    TV,
    (body) => body?.library && !body.library.watchLater.includes(VIDEO),
  );
  await (await menuItem(page, "Controls", "Remove from Watch Later")).click();
  step(
    "Controls > Remove from Watch Later takes the video shown out of Watch Later, saved",
    (await saved).status() === 200 &&
      (await window.getByRole("button", { name: "Add to Watch Later" }).count()) === 1,
  );
  saved = nextPut(page, TV, (body) => body?.library?.watchLater?.includes(VIDEO));
  await (await menuItem(page, "Controls", "Add to Watch Later")).click();
  step("Controls > Add to Watch Later puts it back, saved", (await saved).status() === 200);

  // Controls > Play opens the player; Pause and the skips follow YouTube's player.
  await (await menuItem(page, "Controls", "Play")).click();
  const player = window.locator("section.mac-tv-player");
  await player.waitFor({ timeout: 15_000 });
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
  if (outcome === "playing") {
    await (await menuItem(page, "Controls", "Pause")).click();
    const paused = await page
      .waitForFunction(
        (element) => element.dataset.state === "paused",
        await player.elementHandle(),
        {
          timeout: 10_000,
        },
      )
      .then(
        () => true,
        () => false,
      );
    step("Controls > Play opens the player, and Controls > Pause pauses YouTube's player", paused);
  } else if (allowRefusal && (outcome === "error 150" || outcome === "error 101")) {
    const play = await menuItem(page, "Controls", "Play");
    const back = page.getByRole("menuitem", { name: "Skip Back 10 Seconds", exact: true });
    const forward = page.getByRole("menuitem", { name: "Skip Forward 10 Seconds", exact: true });
    const menuDimmed = (await dimmed(play)) && (await dimmed(back)) && (await dimmed(forward));
    await page.keyboard.press("Escape");
    const hudPlay = player
      .getByRole("group", { name: "Playback controls" })
      .getByRole("button", { name: "Play", exact: true });
    step(
      `Controls > Play opens the player; YouTube refused this network (${outcome}), so Controls' Play and skips are dimmed, as are the player's own`,
      menuDimmed && (await dimmed(hudPlay)),
      outcome,
    );
  } else {
    step(
      "Controls > Play opens a player that plays, or says YouTube refused it",
      false,
      String(outcome),
    );
  }
  await player.getByRole("button", { name: "Done" }).click();

  // TV > Preferences…: List Size kept; the rest dimmed with reasons.
  await (await menuItem(page, "TV", "Preferences…")).click();
  let general = page.getByRole("dialog", { name: "General" });
  await general.waitFor({ timeout: 10_000 });
  const downloads = general.getByRole("checkbox", { name: "Always check for available downloads" });
  const reason = (await downloads.getAttribute("title")) ?? "";
  step(
    "TV > Preferences… shows the settings TV cannot carry out dimmed, each saying why",
    (await dimmed(downloads)) &&
      /no store/.test(reason) &&
      /Dimmed settings are not available here/.test((await general.textContent()) ?? ""),
    reason,
  );
  await general.getByRole("combobox", { name: "List Size:" }).click();
  await page.getByRole("option", { name: "Large" }).click();
  const kept = nextPut(page, TV_PREFERENCES, (body) => body?.preferences?.listSize === "large");
  await general.getByRole("button", { name: "OK" }).click();
  step("List Size Large is saved through PUT /api/tv/preferences", (await kept).status() === 200);

  await reloadDesktop(page);
  window = await openFromDock(page, "TV", "region", "TV");
  await window.getByRole("button", { name: "Library" }).click();
  const width = await window
    .getByRole("region", { name: "Watch Later" })
    .evaluate((element) => element.style.getPropertyValue("--mac-card-grid-min-card-width"));
  const stored = await api(page, "GET", TV_PREFERENCES);
  step(
    "after a reload, the server holds List Size Large, and the Library's cards are that wide",
    stored.json.preferences?.listSize === "large" && width === "288px",
    `${JSON.stringify(stored.json.preferences)}, ${width}`,
  );
  await (await menuItem(page, "TV", "Preferences…")).click();
  general = page.getByRole("dialog", { name: "General" });
  await general.waitFor({ timeout: 10_000 });
  const shown = (await general.getByRole("combobox", { name: "List Size:" }).textContent()) ?? "";
  await general.getByRole("button", { name: "Cancel" }).click();
  step("and TV's Preferences open on Large", /Large/.test(shown), shown);

  // Another browser, a guest of its own: none of it.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const other = await context.newPage();
    await openDesktop(other, base, () => true);
    const theirs = await api(other, "GET", TV_PREFERENCES);
    const theirLibrary = await api(other, "GET", TV);
    step(
      "another browser's person has no TV preferences and no TV library",
      theirs.json.preferences === null && theirLibrary.json.library === null,
      `${JSON.stringify(theirs.json.preferences)} ${JSON.stringify(theirLibrary.json.library)}`,
    );
  } finally {
    await context.close();
  }
  await window.getByRole("button", { name: "Close" }).first().click();
}

/** The files of the drive's Movies folder (whose id is `movies`), outside the Trash. */
async function movieFiles(page) {
  const drive = await api(page, "GET", DRIVE);
  const entries = drive.json?.entries ?? [];
  return entries.filter((entry) => entry.parent === "movies" && entry.trashed_ms === undefined);
}

/** What this run made, and only that, so its cleanup touches nothing else of the person's. */
const made = { movie: null, moviesBefore: null, tv: false, recents: false };

async function movieWindow(page) {
  const window = page.getByRole("region", { name: MOVIE_NAME, exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 30_000 });
  const video = window.locator("video");
  await page.waitForFunction(
    (element) => element.readyState >= 1 && element.duration > 0,
    await video.elementHandle(),
    {
      timeout: 20_000,
    },
  );
  return { window, video };
}

async function quickTime(page) {
  // QuickTime Player does not come with the desktop: get it as the App Store does.
  const store = await api(page, "GET", STORE);
  const installed = store.json.installed ?? [];
  if (!installed.includes("quicktime-player")) {
    await api(page, "PUT", STORE, {
      installed: [...installed, "quicktime-player"],
      rev: store.json.rev,
    });
  }
  await reloadDesktop(page);
  let panel = await openFromDock(page, "QuickTime Player", "region", "Open");
  step("QuickTime Player opens on its Open panel", await panel.isVisible());

  const before = new Set((await movieFiles(page)).map((entry) => entry.id));
  made.moviesBefore = before;
  made.recents = true;
  await panel.locator('input[type="file"]').setInputFiles(MOVIE);
  let { window, video } = await movieWindow(page);
  // The upload is the one Movies file that was not there before: its id, not its name, names it.
  const file = (await movieFiles(page)).find(
    (entry) => !before.has(entry.id) && entry.name.startsWith("test-pattern"),
  );
  made.movie = file?.id ?? null;
  step(
    "From This Computer uploads the movie into the drive's Movies folder",
    Boolean(file),
    file?.id,
  );
  step(
    "the movie window plays the file read back from the drive",
    (await video.getAttribute("src"))?.startsWith("blob:") &&
      (await window.getByText("00:00:12:00").count()) === 1,
  );

  const controls = window.getByRole("group", { name: "Playback controls" });
  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(
    (element) => !element.paused && element.currentTime > 1,
    await video.elementHandle(),
    {
      timeout: 15_000,
    },
  );
  const decoded = await video.evaluate((element) => element.videoWidth);
  step(
    "Play plays it: its time moves and its frames decode",
    decoded === 320,
    `${decoded} px wide`,
  );
  await window.hover();
  await controls.getByRole("button", { name: "Pause", exact: true }).click();
  step("Pause pauses it", await video.evaluate((element) => element.paused));

  await controls.getByRole("slider", { name: "Timeline" }).focus();
  await page.keyboard.press("PageUp");
  const seeked = await video.evaluate((element) => element.currentTime);
  step(
    "the timeline seeks: Page Up moves the movie on ten seconds",
    seeked >= 10,
    `${seeked.toFixed(2)} s`,
  );
  await page.keyboard.press("Home");

  await controls.getByRole("button", { name: "Mute" }).click();
  const muted = await video.evaluate((element) => [element.muted, element.volume]);
  await controls.getByRole("button", { name: "Full Volume" }).click();
  const loud = await video.evaluate((element) => [element.muted, element.volume]);
  step(
    "Mute and Full Volume set the movie's volume",
    muted[0] === true && muted[1] === 0 && loud[0] === false && loud[1] === 1,
  );

  await controls.getByRole("button", { name: "Play", exact: true }).click();
  await controls.getByRole("button", { name: "Picture in Picture" }).click();
  const floating = await page
    .waitForFunction(
      () => {
        if (document.pictureInPictureElement) return "the browser's own window";
        const canvas = document.querySelector(
          ".mac-picture-in-picture canvas.mac-quicktime-player-mirror",
        );
        return canvas && canvas.width > 0 ? "the floating window in the desktop" : null;
      },
      null,
      { timeout: 10_000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => null);
  step("Picture in Picture floats the playing movie", floating !== null, floating ?? "");
  // Back, as a person does: onto the controller's Picture in Picture button (moving there wakes
  // the controller of a playing movie), a pause, and a click. In Google Chrome the movie is in
  // the browser's own Picture in Picture window by now; the button must bring it back all the
  // same, so the return is asserted, never made from a script.
  const pipButton = controls.getByRole("button", { name: "Picture in Picture" });
  const pipAt = await pipButton.boundingBox({ timeout: 10_000 }).catch(() => null);
  if (pipAt) {
    const x = pipAt.x + pipAt.width / 2;
    const y = pipAt.y + pipAt.height / 2;
    await page.mouse.move(x, y - 80);
    await page.mouse.move(x, y, { steps: 5 });
    await page.waitForTimeout(400);
    await page.mouse.click(x, y);
  }
  const returned = await page
    .waitForFunction(
      () =>
        !document.pictureInPictureElement &&
        !document.querySelector(".mac-picture-in-picture canvas.mac-quicktime-player-mirror"),
      null,
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false);
  step(
    "Picture in Picture's button brings the movie back to the window",
    !!pipAt && returned && (await pipButton.getAttribute("aria-pressed")) === "false",
    floating ?? "",
  );

  await window.locator(".mac-quicktime-player-movie").dblclick();
  const full = await page
    .waitForFunction(
      () => document.fullscreenElement?.classList.contains("mac-quicktime-player") ?? false,
      null,
      {
        timeout: 5_000,
      },
    )
    .then(() => true)
    .catch(() => false);
  step("a double click on the picture fills the screen", full);
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());

  // Stop, and move to a place the 12-second movie keeps: within its last 5 seconds a movie counts
  // as watched and opens at its start again. A paused movie's place is saved exactly.
  await window.hover();
  const pause = controls.getByRole("button", { name: "Pause", exact: true });
  if ((await pause.count()) > 0) await pause.click();
  const kept = nextPut(page, RECENTS, (body) => body?.recents?.[0]?.position === 3);
  await video.evaluate((element) => {
    element.currentTime = 3.4;
  });
  const place = JSON.parse((await kept).request().postData() ?? "null")?.recents?.[0]?.position;
  step(
    "its place is kept in Recents through PUT /api/quicktime-player/recents",
    place === 3,
    `${place} s`,
  );
  await shot(page, path.join(out, `quicktime-player-${browserName}.png`));

  await reloadDesktop(page);
  // The desktop gives the window back after a reload, and the window opens its movie again.
  ({ window, video } = await movieWindow(page));
  const restored = await video.evaluate((element) => element.currentTime);
  step(
    "after a reload the window opens its movie again where it was left",
    Math.abs(restored - place) < 1.5,
    `${restored.toFixed(2)} s`,
  );
  await page
    .locator(".mac-dock")
    .getByRole("button", { name: /^QuickTime Player$/ })
    .click();
  await (await menuItem(page, "File", "Open File…")).click();
  panel = page.getByRole("region", { name: "Open", exact: true }).first();
  await panel.waitFor({ state: "visible", timeout: 15_000 });
  const movies = panel.getByRole("listbox", { name: "Movies" });
  await movies.getByText(MOVIE_NAME).waitFor({ timeout: 15_000 });
  await panel.getByRole("treeitem", { name: "Recents" }).click();
  const recents = panel.getByRole("listbox", { name: "Recents" });
  await recents.getByText(MOVIE_NAME).waitFor({ timeout: 10_000 });
  step("after a reload, Movies and Recents list the movie", true);
  // The menu bar's File > Open Recent opens it from the drive.
  await (await menuItem(page, "File", "Open Recent")).hover();
  await page.getByRole("menuitem", { name: MOVIE_NAME, exact: true }).click({ timeout: 5_000 });
  ({ window, video } = await movieWindow(page));
  const resumed = await video.evaluate((element) => element.currentTime);
  step(
    "File > Open Recent opens it from the drive where it was left",
    Math.abs(resumed - place) < 1.5,
    `${resumed.toFixed(2)} s`,
  );
  await window
    .getByRole("group", { name: "Playback controls" })
    .getByRole("button", { name: "Play", exact: true })
    .click();
  await page.waitForFunction(
    ({ element, from }) => !element.paused && element.currentTime > from + 0.5,
    { element: await video.elementHandle(), from: place },
    {
      timeout: 15_000,
    },
  );
  step("and plays", true);
  await shot(page, path.join(out, `quicktime-player-reopened-${browserName}.png`));
  await window
    .getByRole("group", { name: "Playback controls" })
    .getByRole("button", { name: "Pause", exact: true })
    .click()
    .catch(() => {});

  // File > Open File… goes back to the Open panel.
  await (await menuItem(page, "File", "Open File…")).click();
  const again = await page
    .getByRole("region", { name: "Open", exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .then(
      () => true,
      () => false,
    );
  step("File > Open File… goes back to the Open panel", again);

  // Another browser, a guest of its own: no recents, and no movie of this one's in its Movies.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const other = await context.newPage();
    await openDesktop(other, base, () => true);
    const theirs = await api(other, "GET", RECENTS);
    const theirMovies = await movieFiles(other);
    step(
      "another browser's person has no QuickTime recents and none of this movie",
      theirs.json.recents === null && !theirMovies.some((entry) => entry.id === made.movie),
      `${JSON.stringify(theirs.json.recents)}, ${theirMovies.length} movies`,
    );
  } finally {
    await context.close();
  }
}

/** Take away what this run made: its own upload by id, and documents it started empty. */
async function cleanUp(page) {
  tearingDown = true;
  // A reload ends the movie window, so no last save of its place can follow the delete below.
  await reloadDesktop(page).catch(() => {});
  // An upload whose window never opened is still this run's: the one new test pattern in Movies.
  if (!made.movie && made.moviesBefore) {
    const before = made.moviesBefore;
    const mine = (await movieFiles(page)).find(
      (entry) => !before.has(entry.id) && entry.name.startsWith("test-pattern"),
    );
    made.movie = mine?.id ?? null;
  }
  if (made.movie) {
    await api(page, "POST", `${DRIVE}ops`, { ops: [{ op: "delete", id: made.movie }] });
  }
  if (made.tv) {
    await api(page, "DELETE", TV);
    await api(page, "DELETE", TV_PREFERENCES);
  }
  if (made.recents) await api(page, "DELETE", RECENTS);
}

console.log(`tv in ${browserName}`);
const browser = await ENGINES[browserName].launch(launchOptions[engineFamily(browserName)]);
// Every action and wait of the journey times out (30 s) rather than hanging: a stuck step fails.
const openContext = browser.newContext.bind(browser);
browser.newContext = async (...args) => {
  const context = await openContext(...args);
  context.setDefaultTimeout(30_000);
  return context;
};
let page = null;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  watch(page);
  // A fresh browser signs in as Guest User, whose desktop is its own and starts empty. The
  // journey checks that it does, and refuses to run over anyone's TV library or Recents.
  await openDesktop(page, base, step);
  const [library, recents] = [await api(page, "GET", TV), await api(page, "GET", RECENTS)];
  const fresh = library.json?.rev === 0 && recents.json?.rev === 0;
  step(
    "the journey runs on a guest desktop of its own, whose TV library and Recents are empty",
    fresh,
    `TV rev ${library.json?.rev}, Recents rev ${recents.json?.rev}`,
  );
  if (!fresh) throw new Error("not a fresh guest desktop: nothing was changed");
  made.tv = true;
  await tv(page);
  await tvControlsAndPreferences(page);
  await quickTime(page);
} catch (error) {
  problems.push(`journey aborted: ${error instanceof Error ? error.message : error}`);
} finally {
  if (page) await cleanUp(page).catch((error) => problems.push(`clean-up failed: ${error}`));
  await browser.close();
}
console.log(`screenshots in ${out}`);
if (notes.length > 0) {
  const unique = [...new Set(notes)];
  console.log(`\n${unique.length} note(s) on YouTube's own frame and requests (not failures):`);
  for (const note of unique.slice(0, 20)) console.log(`  - ${note}`);
}
if (problems.length > 0) {
  console.error(
    `\ntv: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`\ntv: all ${steps} steps passed with no console errors from the desktop`);

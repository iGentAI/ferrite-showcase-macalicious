#!/usr/bin/env node
// Music's rows of the inventory that had no picture of their own: the Dock menu, Composers, the
// Visualizer's drawings, Help and Keyboard Shortcuts, Share Song, the place kept across a reload,
// copy and paste between playlists, and the commands, sidebar places and playback controls the
// other Music journeys only read back from the server. Songs are real files imported through the
// window; the Internet Archive song is written through the library's API, so Share has a link.
//
//   node e2e/music-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("music-rows", { ignoreOtherOrigins: true });

const LIBRARY = "/api/music/library";
const PLAYBACK = "/api/music/playback";
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

/** A mono WAV of `seconds`, naming its song in a RIFF INFO list. */
function wav(title, artist, album, seconds = 20) {
  const rate = 8_000;
  const pcm = Buffer.alloc(rate * 2 * seconds);
  for (let i = 0; i < pcm.length / 2; i += 1)
    pcm.writeInt16LE(Math.round(Math.sin(i / 7) * 4000), i * 2);
  const chunk = (id, body) => {
    const head = Buffer.alloc(8);
    head.write(id, 0, "ascii");
    head.writeUInt32LE(body.length, 4);
    return Buffer.concat([head, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const text = (value) => Buffer.from(`${value}\0`);
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(1, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const info = Buffer.concat([
    Buffer.from("INFO"),
    chunk("INAM", text(title)),
    chunk("IART", text(artist)),
    chunk("IPRD", text(album)),
  ]);
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

const settled = async (page, name) => {
  await page.waitForTimeout(350);
  await shot(page, path.join(out, name));
};
const read = async (page, url, field) => (await api(page, "GET", url)).json?.[field];
const library = (page) => read(page, LIBRARY, "library");
const playback = (page) => read(page, PLAYBACK, "playback");

const rowOf = (window, title) => window.getByRole("row", { name: new RegExp(title) }).first();
const placeOf = (window, name) =>
  window.getByRole("tree", { name: "Music" }).getByRole("treeitem", { name, exact: true });
const menuTitle = (page, title) =>
  page.getByRole("menubar").first().getByRole("menuitem", { name: title, exact: true }).first();
const dockMusic = (page) =>
  page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Music", exact: true });
/** A menu held open for its picture, closed after. */
async function shotOfMenu(page, title, name) {
  await menuTitle(page, title).click();
  await settled(page, name);
  await closeMenus(page);
}

async function openMusic(page) {
  await launch(page, "Music");
  const window = page.getByRole("region", { name: "Music", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  return window;
}

const SONGS = [
  ["Row Fir", "Trees", "Woods"],
  ["Row Ash", "Trees", "Woods"],
  ["Row Gale", "Weather", "Sky"],
];

await run(async (page) => {
  await openDesktop(page, base, step);
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"])
    .catch(() => {});
  let window = await openMusic(page);

  // ---- Import, and the menu rows that act on what is imported ---------------------------------
  const files = SONGS.map(([title, artist, album], index) => {
    const file = path.join(out, `music-rows-${index}.wav`);
    writeFileSync(file, wav(title, artist, album));
    return file;
  });
  const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
  await chooseMenu(page, "File", "Import…");
  await (await chooser).setFiles(files);
  step(
    "File > Import… adds the files chosen",
    await until(async () => (await library(page))?.songs?.length === 3, 45_000),
    `${(await library(page))?.songs?.length} songs`,
  );
  await shotOfMenu(page, "File", "music-rows-file-menu.png");

  await placeOf(window, "Songs").click();
  await rowOf(window, "Row Fir").waitFor({ timeout: 10_000 });
  await settled(page, "music-rows-songs.png");

  await rowOf(window, "Row Ash").click();
  await rowOf(window, "Row Gale").click({ modifiers: [COMMAND] });
  await page.keyboard.press(`Shift+${COMMAND}+KeyA`);
  step(
    "Edit > Deselect All empties the selection",
    await until(
      async () => (await window.locator('[role="row"][aria-selected="true"]').count()) === 0,
      4_000,
    ),
  );
  await shotOfMenu(page, "Edit", "music-rows-edit-menu.png");
  await chooseMenu(page, "Edit", "Find");
  step(
    "Edit > Find puts the keyboard in the search field",
    await until(() =>
      window
        .locator("input[type=search], input")
        .evaluateAll((all) => all.includes(document.activeElement)),
    ),
  );
  await page.keyboard.type("Gale");
  await rowOf(window, "Row Gale").waitFor({ timeout: 8_000 });
  step("the library search finds the song", (await window.getByRole("row").count()) <= 3);
  await settled(page, "music-rows-search.png");
  await page.keyboard.press("Escape");
  await window.locator("input").first().fill("");

  // ---- Sort by heading -------------------------------------------------------------------------
  await placeOf(window, "Songs").click();
  await window
    .getByRole("columnheader", { name: /Name|Title|Song/ })
    .first()
    .click();
  await settled(page, "music-rows-sorted.png");
  const order = async () =>
    (await window.getByRole("grid", { name: "Songs" }).getByRole("row").allInnerTexts()).join("|");
  const first = await order();
  await window
    .getByRole("columnheader", { name: /Name|Title|Song/ })
    .first()
    .click();
  step("a heading click turns the sort over", await until(async () => (await order()) !== first));

  // ---- Song Info's Composer, and the Composers view ---------------------------------------------
  await rowOf(window, "Row Fir").click();
  await page.keyboard.press(`${COMMAND}+KeyI`);
  const info = page.getByRole("dialog").filter({ hasText: "Composer" });
  await info.getByLabel("Composer").fill("Ada Row");
  await info.getByRole("button", { name: "OK" }).click();
  step(
    "Song Info saves a composer on the server",
    await until(
      async () =>
        (await library(page)).songs.find((song) => song.title === "Row Fir")?.composer ===
        "Ada Row",
    ),
  );
  await placeOf(window, "Composers").click();
  await window.getByText("Ada Row").first().waitFor({ timeout: 8_000 });
  step(
    "Composers lists the composer and those with none",
    await window.getByText("Unknown Composer").first().isVisible(),
  );
  await settled(page, "music-rows-composers.png");

  // ---- The sidebar's places ---------------------------------------------------------------------
  for (const [name, shotName] of [
    ["Recently Added", "music-rows-recently-added.png"],
    ["Artists", "music-rows-artists.png"],
    ["Albums", "music-rows-albums.png"],
  ]) {
    await placeOf(window, name).click();
    await window.getByText("Woods").first().waitFor({ timeout: 8_000 });
    await settled(page, shotName);
  }
  await window.getByRole("button", { name: /Woods/ }).first().click();
  step(
    "an album opens on its songs",
    await window
      .getByRole("row", { name: /Row Ash/ })
      .first()
      .isVisible(),
  );
  await settled(page, "music-rows-album-detail.png");

  // ---- Add to Playlist, ⌘N, copy and paste between playlists ------------------------------------
  await placeOf(window, "Songs").click();
  await rowOf(window, "Row Fir").click();
  await chooseMenu(page, "Song", "Add to Playlist", "New Playlist");
  step(
    "Song > Add to Playlist makes a playlist of the song",
    await until(async () => (await library(page)).playlists.length === 1),
  );
  await page.keyboard.press("Escape");
  await placeOf(window, "Songs").click();
  await window.click({ position: { x: 300, y: 300 } }).catch(() => {});
  await page.keyboard.press(`${COMMAND}+KeyN`);
  step(
    "File > New > Playlist ⌘N makes an empty playlist",
    await until(async () => (await library(page)).playlists.length === 2),
  );
  await page.keyboard.press("Enter");
  const [firstList, secondList] = (await library(page)).playlists;
  await placeOf(window, firstList.name).click();
  await rowOf(window, "Row Fir").click();
  await chooseMenu(page, "Edit", "Copy");
  await placeOf(window, secondList.name).click();
  await chooseMenu(page, "Edit", "Paste");
  step(
    "Copy in one playlist and Paste in another adds the song there",
    await until(
      async () =>
        (await library(page)).playlists.find((p) => p.id === secondList.id).songs.length === 1,
    ),
  );
  await settled(page, "music-rows-pasted.png");

  // ---- Playback: Return, Space, Next, Previous, the Now Playing display, Media Session -----------
  await placeOf(window, "Songs").click();
  await rowOf(window, "Row Ash").click();
  await page.keyboard.press("Enter");
  const ids = Object.fromEntries((await library(page)).songs.map((song) => [song.title, song.id]));
  const isOn = async (title) => {
    const now = await playback(page);
    return now?.queue?.[now.index] === ids[title];
  };
  step("Return plays the selected song", await until(() => isOn("Row Ash")));
  const paused = () => window.getByRole("button", { name: "Play", exact: true });
  const playingButton = () => window.getByRole("button", { name: "Pause", exact: true });
  await playingButton().waitFor({ timeout: 8_000 });
  await settled(page, "music-rows-now-playing.png");
  step(
    "Media Session names the song for the system's media keys",
    await until(() => page.evaluate(() => navigator.mediaSession?.metadata?.title === "Row Ash")),
  );
  await rowOf(window, "Row Ash").click();
  await page.keyboard.press("Space");
  step(
    "Space pauses",
    await paused()
      .waitFor({ timeout: 5_000 })
      .then(() => true),
  );
  await page.keyboard.press("Space");
  step(
    "and Space plays again",
    await playingButton()
      .waitFor({ timeout: 5_000 })
      .then(() => true),
  );
  await shotOfMenu(page, "Controls", "music-rows-controls-menu.png");
  // Transport and the volume slider. The short song may have ended by now.
  if (await paused().isVisible()) await paused().click();
  await window.getByRole("button", { name: "Shuffle" }).click();
  step(
    "the Shuffle button is kept",
    await until(async () => (await playback(page)).shuffle === true),
  );
  await window.getByRole("button", { name: /^Repeat/ }).click();
  step(
    "the Repeat button is kept",
    await until(async () => (await playback(page)).repeat === "all"),
  );
  // A list row, not the heading: from there the key reaches Music, whose song list has the
  // keyboard. With the keyboard nowhere, Control-Right off a Mac is the desktop's, for Spaces.
  await rowOf(window, "Row Ash").dblclick();
  await playingButton().waitFor({ timeout: 8_000 });
  const sessionTitle = () => page.evaluate(() => navigator.mediaSession?.metadata?.title);
  /** The songs around the one loaded, from the saved queue: Shuffle has its own order. */
  const around = async () => {
    const songs = (await library(page)).songs;
    const named = (id) => songs.find((song) => song.id === id)?.title;
    let saved = {};
    const synced = await until(async () => {
      saved = await playback(page);
      const title = await sessionTitle();
      return title !== undefined && title !== null && named(saved.queue?.[saved.index]) === title;
    }, 8_000);
    const now = named(saved.queue?.[saved.index]);
    const next = named(saved.queue?.[saved.index + 1] ?? saved.queue?.[0]);
    if (!synced || !now || !next) {
      throw new Error(`no queue to compare with: ${JSON.stringify({ now, next, saved })}`);
    }
    return { now, next };
  };
  /** Within far less than a 20 second song, the very song the queue names, by the command alone. */
  const becomes = (title) => until(async () => (await sessionTitle()) === title, 4_000);
  /** Paused, the song cannot run out and move on by itself: only the command can change it. */
  const holdStill = async () => {
    if (await playingButton().isVisible()) await playingButton().click();
    await paused().waitFor({ timeout: 5_000 });
  };
  await holdStill();
  await rowOf(window, "Row Ash").click();
  const places = await around();
  await page.keyboard.press(`${COMMAND}+ArrowRight`);
  step(
    "Controls > Next ⌘→ moves on to the next song of the queue",
    await becomes(places.next),
    `${places.now} to ${places.next}: ${await sessionTitle()}`,
  );
  await page.keyboard.press(`${COMMAND}+ArrowLeft`);
  step(
    "Controls > Previous ⌘← goes back to the song before",
    await becomes(places.now),
    await sessionTitle(),
  );
  await window
    .getByRole("slider", { name: /Volume/ })
    .first()
    .focus();
  const volumeBefore = (await playback(page)).volume;
  await page.keyboard.press("ArrowLeft");
  step(
    "the volume slider is kept",
    await until(async () => (await playback(page)).volume !== volumeBefore),
  );
  await settled(page, "music-rows-transport.png");

  // Panels, MiniPlayer.
  await chooseMenu(page, "View", "Show Up Next");
  await window.locator('[data-music-panel="up-next"]').waitFor({ timeout: 5_000 });
  step("View > Show Up Next opens the panel", true);
  await settled(page, "music-rows-up-next.png");
  await chooseMenu(page, "View", "Show Lyrics");
  await window.locator('[data-music-panel="lyrics"]').waitFor({ timeout: 5_000 });
  step("View > Show Lyrics opens the panel", true);
  await settled(page, "music-rows-lyrics.png");
  await chooseMenu(page, "View", "Hide Lyrics");
  await chooseMenu(page, "Window", "Switch to MiniPlayer");
  const mini = page.getByRole("region", { name: "MiniPlayer", exact: true });
  await mini.waitFor({ timeout: 8_000 });
  step("Window > Switch to MiniPlayer opens it", await mini.isVisible());
  await settled(page, "music-rows-mini-player.png");
  await chooseMenu(page, "Window", "Close MiniPlayer");

  // ---- The Dock menu -----------------------------------------------------------------------------
  await dockMusic(page).click({ button: "right" });
  const dockMenu = page.getByRole("menu", { name: "Music" });
  await dockMenu.waitFor({ timeout: 5_000 });
  const nowTitle = await page.evaluate(() => navigator.mediaSession?.metadata?.title);
  step(
    "the Dock menu names the song playing",
    await dockMenu.getByRole("menuitem", { name: nowTitle, exact: true }).isVisible(),
    nowTitle,
  );
  await settled(page, "music-rows-dock-menu.png");
  for (let turn = 0; turn < 2; turn += 1) {
    if (turn > 0) await dockMusic(page).click({ button: "right" });
    const toggle = dockMenu.getByRole("menuitem", { name: /^(Play|Pause)$/ });
    const said = (await toggle.innerText()).trim();
    await toggle.click();
    const after = said === "Play" ? playingButton() : paused();
    step(
      `its ${said} acts`,
      await after.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      ),
    );
  }
  await holdStill();
  await dockMusic(page).click({ button: "right" });
  const dockPlaces = await around();
  await dockMenu.getByRole("menuitem", { name: "Next", exact: true }).click();
  step(
    "its Next moves on to the next song of the queue",
    await becomes(dockPlaces.next),
    await sessionTitle(),
  );
  await dockMusic(page).click({ button: "right" });
  await dockMenu.getByRole("menuitem", { name: "Previous", exact: true }).click();
  step(
    "its Previous goes back to the song before",
    await becomes(dockPlaces.now),
    await sessionTitle(),
  );

  // ---- Siri: from paused, so that only Siri can start it ---------------------------------------
  if (await playingButton().isVisible()) await playingButton().click();
  await paused().waitFor({ timeout: 5_000 });
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Siri" }).click();
  const siri = page.getByRole("textbox", { name: /Siri|Ask/ }).first();
  await siri.waitFor({ timeout: 8_000 });
  await siri.fill("play music");
  await siri.press("Enter");
  await page
    .getByText(/^Playing “/)
    .first()
    .waitFor({ timeout: 10_000 });
  step(
    "Siri plays Music",
    await playingButton()
      .waitFor({ timeout: 5_000 })
      .then(() => true),
  );
  await settled(page, "music-rows-siri.png");
  await page.keyboard.press("Escape");
  await page
    .getByRole("region", { name: "Music", exact: true })
    .first()
    .click({ position: { x: 300, y: 12 } });

  // ---- Help, Keyboard Shortcuts, Emoji & Symbols, Page Setup -----------------------------------
  await shotOfMenu(page, "Help", "music-rows-help-menu.png");
  await chooseMenu(page, "Help", "Keyboard Shortcuts");
  const shortcuts = page.getByRole("dialog", { name: "Keyboard Shortcuts" });
  await shortcuts.waitFor({ timeout: 5_000 });
  step(
    "Keyboard Shortcuts lists the menus' keys",
    (await shortcuts.getByText("Switch to MiniPlayer").isVisible()) &&
      (await shortcuts.getByText("⇧⌘M").isVisible()),
  );
  await settled(page, "music-rows-shortcuts.png");
  await shortcuts.getByRole("button", { name: "Done" }).click();
  await chooseMenu(page, "Help", "Music Help");
  const help = page.getByRole("region", { name: /Help/ }).first();
  await help.waitFor({ timeout: 10_000 });
  await help
    .getByText(/Listen to music/)
    .first()
    .waitFor({ timeout: 10_000 });
  step("Music Help opens Help Viewer on Music", true);
  await settled(page, "music-rows-help.png");
  await page.keyboard.press(`${COMMAND}+KeyW`);
  await dockMusic(page).click();

  step(
    "File > Page Setup… is offered",
    !(await menuItemState(page, "File", "Page Setup…")).disabled,
  );
  step(
    "Controls > Eject Disc is dimmed, saying why",
    (await menuItemState(page, "Controls", "Eject Disc")).disabled,
  );
  await shotOfMenu(page, "Account", "music-rows-account-menu.png");
  for (const name of [
    "Check for Available Downloads…",
    "Authorizations",
    "Wish List",
    "Purchased",
    "Redeem…",
  ]) {
    step(
      `Account > ${name} is dimmed, saying why`,
      (await menuItemState(page, "Account", name)).disabled,
    );
  }
  await chooseMenu(page, "Edit", "Emoji & Symbols");
  await page
    .getByRole("dialog", { name: /Characters|Emoji/ })
    .or(page.getByRole("region", { name: /Characters|Emoji/ }))
    .first()
    .waitFor({ timeout: 5_000 });
  step("Edit > Emoji & Symbols shows the character viewer", true);
  await settled(page, "music-rows-emoji.png");
  await chooseMenu(page, "Edit", "Emoji & Symbols");

  // ---- Visualizer's drawings ----------------------------------------------------------------------
  await chooseMenu(page, "View", "Show Visualizer");
  await chooseMenu(page, "View", "Visualizer", "Classic Visualizer");
  await window.getByRole("img", { name: /^Visualizer:/ }).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(400);
  step(
    "View > Visualizer chooses the Classic drawing, kept",
    await until(
      async () =>
        (await read(page, "/api/system-preferences/settings", "values"))?.[
          "music.visualizerDrawing"
        ] === "classic",
    ),
  );
  await settled(page, "music-rows-visualizer-classic.png");
  await chooseMenu(page, "View", "Hide Visualizer");

  // ---- Share Song: an Archive song's link, and what a song on the drive answers ---------------
  await placeOf(window, "Browse").click();
  const search = window
    .getByRole("searchbox", { name: "Search the Internet Archive" })
    .or(window.getByRole("textbox", { name: "Search the Internet Archive" }))
    .first();
  await window.locator(".mac-card-grid-card").first().waitFor({ timeout: 30_000 });
  step("Browse lists the Internet Archive's openly licensed music", true);
  await search.fill("bach");
  await search.press("Enter");
  await window.getByText("Results", { exact: true }).first().waitFor({ timeout: 30_000 });
  await window.locator(".mac-card-grid-card").first().click();
  await window.getByRole("grid", { name: /^Tracks of / }).waitFor({ timeout: 30_000 });
  await settled(page, "music-rows-archive-item.png");
  await window.getByRole("button", { name: "Add to Library" }).click();
  step(
    "Add to Library adds the item's tracks, with its licence",
    await until(async () =>
      (await library(page)).songs.some(
        (song) => song.source?.kind === "archive" && /^https?:\/\//.test(song.source.license ?? ""),
      ),
    ),
  );
  const reel = (await library(page)).songs.find((song) => song.source?.kind === "archive");
  const reelRow = window.getByRole("row").filter({ hasText: reel.title }).first();
  await placeOf(window, "Songs").click();
  await reelRow.click();
  await menuTitle(page, "Song").click();
  await page.getByRole("menuitem", { name: "Share Song", exact: true }).last().hover();
  await page.getByRole("menuitem", { name: "Copy Link", exact: true }).waitFor({ timeout: 4_000 });
  await settled(page, "music-rows-share-menu.png");
  await page.getByRole("menuitem", { name: "Copy Link", exact: true }).click();
  step(
    "Song > Share Song > Copy Link puts the Archive's page on the clipboard",
    await until(
      async () =>
        (await page.evaluate(() => navigator.clipboard.readText())) ===
        `https://archive.org/details/${encodeURIComponent(reel.source.item)}`,
    ),
  );
  await rowOf(window, "Row Gale").click();
  await menuTitle(page, "Song").click();
  await page.getByRole("menuitem", { name: "Share Song", exact: true }).last().hover();
  const noLink = page.getByRole("menuitem", { name: "Copy Link", exact: true });
  await noLink.waitFor({ timeout: 4_000 });
  step(
    "a song on the drive has no address to share",
    (await noLink.getAttribute("aria-disabled")) === "true",
  );
  await closeMenus(page);

  // ---- The place left open, kept across a reload ---------------------------------------------
  const kept = (await library(page)).playlists[0].name;
  await placeOf(window, kept).click();
  step(
    "the place left open is saved",
    await until(async () =>
      /^playlist:/.test(
        (await read(page, "/api/system-preferences/settings", "values"))?.["music.place"] ?? "",
      ),
    ),
  );
  await reloadDesktop(page);
  window = await openMusic(page);
  step(
    "after a reload Music opens on that playlist",
    await window
      .getByRole("grid", { name: kept })
      .waitFor({ timeout: 10_000 })
      .then(() => true),
  );
  await settled(page, "music-rows-place-kept.png");

  // ---- Saved: library and playback read back ------------------------------------------------------
  const savedLibrary = await library(page);
  const savedPlayback = await playback(page);
  step(
    "after the reload the server holds the library and the playback",
    savedLibrary.songs.length > 3 &&
      savedLibrary.playlists.length === 2 &&
      savedPlayback.shuffle === true &&
      savedPlayback.repeat === "all",
    JSON.stringify({ songs: savedLibrary.songs.length, repeat: savedPlayback.repeat }),
  );

  // ---- Show in Finder, sidebar playlist Export ----------------------------------------------------
  await placeOf(window, "Songs").click();
  await rowOf(window, "Row Gale").click();
  await page.keyboard.press(`Shift+${COMMAND}+KeyR`);
  const galeFile = savedLibrary.songs.find((song) => song.title === "Row Gale").source.name;
  const finder = page.locator(".mac-window.mac-finder").last();
  const chosenInFinder = await until(
    async () =>
      (await finder.locator('[role="option"][aria-selected="true"]').allInnerTexts()).some((text) =>
        text.includes(galeFile),
      ),
    8_000,
  );
  step(
    "File > Show in Finder selects the song's file in a Finder window",
    chosenInFinder,
    galeFile,
  );
  await settled(page, "music-rows-show-in-finder.png");
  await page.keyboard.press(`${COMMAND}+KeyW`);
  await dockMusic(page).click();
  await placeOf(window, kept).click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Export/ }).click();
  await page
    .locator(".mac-music-desktop-status")
    .getByText(/^Saved as/)
    .waitFor({ timeout: 30_000 });
  const exported = await page.evaluate(async (name) => {
    const drive = await (await fetch("/api/files", { credentials: "same-origin" })).json();
    const downloads = drive.entries.find(
      (entry) => entry.name === "Downloads" && entry.parent === undefined,
    );
    const file = drive.entries.find(
      (entry) => entry.name === `${name}.m3u` && entry.parent === downloads?.id,
    );
    if (!file) return "";
    const content = await fetch(
      `/api/files/content/${file.id}?piece=0&count=8&version=${file.version ?? 0}`,
      { credentials: "same-origin" },
    );
    return content.text();
  }, kept);
  const keptSongs = savedLibrary.playlists
    .find((list) => list.name === kept)
    .songs.map((id) => savedLibrary.songs.find((song) => song.id === id)?.title);
  step(
    "the sidebar playlist's Export writes a file on the drive naming its songs",
    keptSongs.length > 0 && keptSongs.every((title) => exported.includes(title)),
    exported,
  );
  await settled(page, "music-rows-sidebar-export.png");
});

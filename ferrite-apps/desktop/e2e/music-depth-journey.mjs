#!/usr/bin/env node
// Music's depth on Ferrite: its menus, multiple selection, and what they do, each checked on the
// server or on the media element, with real input only.
//
//   ferrite dev --egress allow                          # in ferrite-apps/desktop
//   node e2e/music-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]
//        [--browser chromium|chrome|firefox|webkit]
//
// Writes screenshots to --out. Exits 0 only when every step passed and the page logged no console
// error, page error, failed request or HTTP error.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, shot } from "./app-journey.mjs";
import { reloadDesktop } from "./journey-kit.mjs";
import { chooseMenu, closeMenus, until } from "./media-census-kit.mjs";

const LIBRARY = "/api/music/library";
const PLAYBACK = "/api/music/playback";
const TITLES = ["Depth Anchor", "Depth Bell", "Depth Cove", "Depth Dune"];
const { base, out } = options();
const { step, run, expectRefusal } = journey("music-depth", { ignoreOtherOrigins: true });

/** A short mono WAV naming its song in a RIFF INFO list. */
function wav(title, index) {
  const rate = 8_000;
  const pcm = Buffer.alloc(rate * 2 * 8);
  for (let i = 0; i < pcm.length / 2; i += 1)
    pcm.writeInt16LE(Math.round(Math.sin((i * (index + 2)) / 8) * 2000), i * 2);
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
    chunk("IART", text("Depth Band")),
    chunk("IPRD", text("Depth Album")),
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

/** A picture once menus have finished fading in and out. */
const settledShot = async (page, name) => {
  await page.waitForTimeout(450);
  await shot(page, path.join(out, name));
};

const read = async (page, url, field) => (await api(page, "GET", url)).json?.[field];

/** Wait until the stored document holds `accept`; the document, or `null` after 15 s. */
async function stored(page, url, field, accept) {
  for (let waited = 0; waited <= 15_000; waited += 250) {
    const value = await read(page, url, field);
    if (value && accept(value)) return value;
    await page.waitForTimeout(250);
  }
  return null;
}
const library = (page, accept) => stored(page, LIBRARY, "library", accept);
const playback = (page, accept) => stored(page, PLAYBACK, "playback", accept);

async function openMusic(page) {
  await launch(page, "Music");
  const window = page.getByRole("region", { name: "Music", exact: true }).first();
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

const row = (window, title) => window.getByRole("row", { name: new RegExp(title) }).first();
const place = (window, name) =>
  window.getByRole("tree", { name: "Music" }).getByRole("treeitem", { name, exact: true });
const selectedRows = (window) => window.locator('[role="row"][aria-selected="true"]').count();
const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

await run(async (page) => {
  await openDesktop(page, base, step);
  // The journey only makes things on an account that has none of Music's documents: a fresh browser.
  const held = [await read(page, LIBRARY, "library"), await read(page, PLAYBACK, "playback")];
  if (held.some((document) => document != null))
    throw new Error("this account already has Music's documents: run the journey on a fresh one");
  const window = await openMusic(page);

  const files = TITLES.map((title, index) => {
    const file = path.join(out, `depth-${index}.wav`);
    writeFileSync(file, wav(title, index));
    return file;
  });
  await window.locator('input[type="file"][aria-label="Add to Library"]').setInputFiles(files);
  const added = await library(page, (l) => l.songs.length === TITLES.length);
  step("four songs are imported", added !== null);
  const id = Object.fromEntries(added.songs.map((song) => [song.title, song.id]));

  // ---- Spotlight shows the song it found --------------------------------------------------------
  const findWithSpotlight = async (title) => {
    await page.getByRole("menuitem", { name: "Spotlight" }).click();
    const field = page.getByRole("combobox", { name: "Spotlight Search" });
    await field.fill(title);
    await page
      .getByRole("group", { name: /^(?:Music|Top Hit)$/ })
      .getByRole("option", { name: new RegExp(title) })
      .waitFor({ timeout: 10_000 });
    await field.press("Enter");
  };
  const selectedSong = async (title) => {
    const songs = window.getByRole("grid", { name: "Songs" });
    await songs.waitFor({ timeout: 10_000 });
    await songs
      .locator('[role="row"][aria-selected="true"]')
      .filter({ hasText: title })
      .waitFor({ timeout: 10_000 });
    return (await selectedRows(window)) === 1;
  };
  await findWithSpotlight("Depth Dune");
  step(
    "Spotlight's song shows selected in Songs, in the open window",
    await selectedSong("Depth Dune"),
  );
  await window.getByRole("button", { name: "Close" }).first().click();
  await window.waitFor({ state: "detached", timeout: 10_000 });
  await findWithSpotlight("Depth Cove");
  await window.waitFor({ state: "visible", timeout: 15_000 });
  step("and in a window it opens", await selectedSong("Depth Cove"));
  await settledShot(page, "music-spotlight-song.png");

  // ---- Multiple selection and the Song menu ---------------------------------------------------
  await place(window, "Songs").click();
  await row(window, "Depth Anchor").click();
  await row(window, "Depth Cove").click({ modifiers: ["Shift"] });
  step("Shift-click selects a range of songs", (await selectedRows(window)) === 3);
  await row(window, "Depth Anchor").click({ modifiers: [COMMAND] });
  step("Command-click takes a song out of the selection", (await selectedRows(window)) === 2);
  await page.keyboard.press(`${COMMAND}+a`);
  step("Command-A selects every song", (await selectedRows(window)) === 4);
  await row(window, "Depth Dune").click({ modifiers: [COMMAND] });

  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Song", exact: true })
    .first()
    .click();
  await settledShot(page, "music-menu-song.png");
  await closeMenus(page);
  await chooseMenu(page, "Song", "Love");
  const loved = await library(page, (l) => l.loved.length === 3);
  step("Song > Love loves all three selected songs", loved !== null, loved?.loved.join());

  await row(window, "Depth Bell").click({ button: "right" });
  await settledShot(page, "music-row-menu.png");
  await page.getByRole("menuitem", { name: "Unlove", exact: true }).click();
  step(
    "a selected row's menu acts on the whole selection",
    (await library(page, (l) => l.loved.length === 0)) !== null,
  );

  // ---- File, Edit: playlists, Undo, Copy and Paste ---------------------------------------------
  await chooseMenu(page, "File", "New", "Playlist from Selection");
  const made = await library(
    page,
    (l) => l.playlists.length === 1 && l.playlists[0].songs.length === 3,
  );
  step(
    "File > New > Playlist from Selection holds the selection, and is shown",
    made !== null && (await window.getByRole("heading", { name: "Untitled Playlist" }).isVisible()),
  );
  await chooseMenu(page, "Edit", "Undo");
  step(
    "Edit > Undo takes the playlist back",
    (await library(page, (l) => l.playlists.length === 0)) !== null,
  );
  await chooseMenu(page, "Edit", "Redo");
  step(
    "Edit > Redo makes it again",
    (await library(page, (l) => l.playlists.length === 1)) !== null,
  );

  await place(window, "Songs").click();
  await row(window, "Depth Dune").click();
  await chooseMenu(page, "Edit", "Copy");
  await place(window, "Untitled Playlist").click();
  await chooseMenu(page, "Edit", "Paste");
  step(
    "Edit > Paste adds the song copied to the playlist",
    (await library(page, (l) => l.playlists[0]?.songs.includes(id["Depth Dune"]))) !== null,
  );
  await row(window, "Depth Dune").click();
  await chooseMenu(page, "Edit", "Cut");
  step(
    "Edit > Cut takes it out of the playlist",
    (await library(
      page,
      (l) => l.playlists[0] && !l.playlists[0].songs.includes(id["Depth Dune"]),
    )) !== null,
  );
  await row(window, "Depth Bell").click();
  await page.keyboard.press("Backspace");
  step(
    "Delete in a playlist takes the song out of the playlist, not the library",
    (await library(page, (l) => l.playlists[0]?.songs.length === 2 && l.songs.length === 4)) !==
      null,
  );

  // ---- Controls ----------------------------------------------------------------------------
  await place(window, "Songs").click();
  await row(window, "Depth Anchor").dblclick();
  await page.waitForFunction(() => document.querySelector('[aria-label="Pause"]') !== null, null, {
    timeout: 15_000,
  });
  await chooseMenu(page, "Controls", "Stop");
  await window.getByRole("button", { name: "Play", exact: true }).waitFor({ timeout: 5_000 });
  step(
    "Controls > Stop stops the song at its start",
    (await playback(page, (p) => p.position === 0)) !== null,
  );
  await chooseMenu(page, "Controls", "Next");
  const next = await playback(page, (p) => p.index === 1);
  step("Controls > Next moves on", next !== null);
  await chooseMenu(page, "Controls", "Decrease Volume");
  step(
    "Controls > Decrease Volume lowers it",
    (await playback(page, (p) => p.volume === 90)) !== null,
  );
  await chooseMenu(page, "Controls", "Increase Volume");
  step(
    "Controls > Increase Volume raises it",
    (await playback(page, (p) => p.volume === 100)) !== null,
  );
  await chooseMenu(page, "Controls", "Repeat", "All");
  step(
    "Controls > Repeat > All sets it",
    (await playback(page, (p) => p.repeat === "all")) !== null,
  );
  await chooseMenu(page, "Controls", "Shuffle", "On");
  step(
    "Controls > Shuffle turns it on",
    (await playback(page, (p) => p.shuffle === true)) !== null,
  );
  await chooseMenu(page, "Controls", "Shuffle", "Off");
  await playback(page, (p) => p.shuffle === false);
  await place(window, "Albums").click();
  await chooseMenu(page, "Controls", "Go to Current Song");
  await window.getByRole("grid", { name: "Songs" }).waitFor({ timeout: 5_000 });
  step("Controls > Go to Current Song shows and selects it", (await selectedRows(window)) === 1);
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Controls", exact: true })
    .first()
    .click();
  await settledShot(page, "music-menu-controls.png");
  await closeMenus(page);

  // ---- View: the sidebar is kept -------------------------------------------------------------
  await chooseMenu(page, "Controls", "Stop");
  await window.getByRole("button", { name: "Play", exact: true }).waitFor({ timeout: 5_000 });
  await row(window, "Depth Dune").click();
  await chooseMenu(page, "Controls", "Play");
  step(
    "Controls > Play while paused starts at the song selected",
    (await playback(page, (p) => p.queue[p.index] === id["Depth Dune"])) !== null,
  );
  await chooseMenu(page, "Controls", "Stop");
  await window.getByRole("button", { name: "Play", exact: true }).waitFor({ timeout: 5_000 });
  await row(window, "Depth Cove").click();
  await page.keyboard.press("Space");
  step(
    "Space while paused starts at the song selected",
    (await playback(page, (p) => p.queue[p.index] === id["Depth Cove"])) !== null,
  );
  await window.getByRole("button", { name: "Pause", exact: true }).waitFor({ timeout: 15_000 });
  await page.keyboard.press("Space");
  await window.getByRole("button", { name: "Play", exact: true }).waitFor({ timeout: 5_000 });
  step("Space again pauses it", true);
  await chooseMenu(page, "Controls", "Stop");
  await chooseMenu(page, "View", "Hide Sidebar");
  await page.waitForTimeout(800);
  step(
    "View > Hide Sidebar hides it",
    (await window.getByRole("tree", { name: "Music" }).count()) === 0,
  );
  await shot(page, path.join(out, "music-sidebar-hidden.png"));
  await page.waitForTimeout(1500);
  await reloadDesktop(page);
  const again = await openMusic(page);
  step(
    "it stays hidden after a reload",
    (await again.getByRole("tree", { name: "Music" }).count()) === 0,
  );
  await chooseMenu(page, "View", "Show Sidebar");
  await again.getByRole("tree", { name: "Music" }).waitFor({ timeout: 5_000 });
  await chooseMenu(page, "View", "Hide Sidebar");
  await again.getByRole("tree", { name: "Music" }).waitFor({ state: "detached", timeout: 5_000 });
  await chooseMenu(page, "Edit", "Find");
  const searchField = again.getByRole("searchbox", { name: "Search your library" });
  await searchField.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(600);
  step(
    "Edit > Find shows the sidebar and gives its search field the keyboard",
    await searchField.evaluate((field) => field === document.activeElement),
  );
  await again.click({ position: { x: 600, y: 500 } });
  await chooseMenu(page, "View", "Hide Sidebar");
  await again.getByRole("tree", { name: "Music" }).waitFor({ state: "detached", timeout: 5_000 });
  // The menu keeps the keyboard until it has faded out.
  await page.waitForTimeout(500);
  await page.keyboard.press(`${COMMAND}+f`);
  await searchField.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);
  step(
    "Command-F does the same",
    await searchField.evaluate((field) => field === document.activeElement),
  );
  await again.click({ position: { x: 600, y: 500 } });

  // ---- Delete asks, and the file's fate is chosen ---------------------------------------------
  await place(again, "Songs").click();
  await row(again, "Depth Anchor").click();
  await row(again, "Depth Bell").click({ modifiers: ["Shift"] });
  await page.keyboard.press("Backspace");
  await page.getByRole("alertdialog").waitFor({ timeout: 5_000 });
  await settledShot(page, "music-delete-alert.png");
  step("Delete asks first", (await read(page, LIBRARY, "library")).songs.length === 4);
  await page.getByRole("button", { name: "Keep File", exact: true }).click();
  step(
    "Keep File takes two songs out of the library",
    (await library(page, (l) => l.songs.length === 2 && l.playlists[0].songs.length === 1)) !==
      null,
  );
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .first()
    .click();
  const undoAfterDelete = page.getByRole("menu").getByRole("menuitem", { name: "Undo" }).first();
  step(
    "a deleted song is not brought back: Undo is dimmed",
    (await undoAfterDelete.getAttribute("aria-disabled")) === "true",
  );
  await closeMenus(page);

  // Undo takes back its own change only: a song imported since stays.
  await row(again, "Depth Dune").click();
  await chooseMenu(page, "Song", "Love");
  await library(page, (l) => l.loved.includes(id["Depth Dune"]));
  const fifth = path.join(out, "depth-4.wav");
  writeFileSync(fifth, wav("Depth Elm", 4));
  await again.locator('input[type="file"][aria-label="Add to Library"]').setInputFiles(fifth);
  await library(page, (l) => l.songs.length === 3);
  await chooseMenu(page, "Edit", "Undo");
  step(
    "Undo of a love keeps the song imported after it",
    (await library(page, (l) => l.loved.length === 0 && l.songs.length === 3)) !== null,
  );

  // An album's rows are selected one by one, and the Song menu acts on them alone.
  await place(again, "Albums").click();
  await again
    .getByRole("button", { name: /Depth Album/ })
    .first()
    .click();
  const albumRows = again.getByRole("grid", { name: /Songs on Depth Album/ });
  await albumRows.getByRole("row", { name: /Depth Cove/ }).click();
  await chooseMenu(page, "Song", "Love");
  step(
    "Love on one row of an album loves that song alone",
    (await library(page, (l) => l.loved.length === 1 && l.loved[0] === id["Depth Cove"])) !== null,
  );
  await chooseMenu(page, "Edit", "Select All");
  step("Select All selects the album's rows", (await selectedRows(albumRows)) === 3);

  // A search that leaves the album's songs off the screen: Delete from Library has nothing to take.
  await chooseMenu(page, "Edit", "Deselect All");
  await again.getByRole("searchbox", { name: "Search your library" }).fill("Depth Dune");
  await page
    .getByRole("menubar")
    .getByRole("menuitem", { name: "Song", exact: true })
    .first()
    .click();
  const hidden = page
    .getByRole("menu")
    .getByRole("menuitem", { name: "Delete from Library" })
    .first();
  step(
    "Delete from Library does not reach an album no longer shown",
    (await hidden.getAttribute("aria-disabled")) === "true",
  );
  await closeMenus(page);
  await again.getByRole("searchbox", { name: "Search your library" }).fill("");

  // Delete from Library deletes from the library, also from a playlist; a song trashed stays gone.
  await place(again, "Untitled Playlist").click();
  await row(again, "Depth Cove").click();
  await chooseMenu(page, "Song", "Delete from Library");
  await page.getByRole("button", { name: "Move to Trash", exact: true }).click();
  step(
    "Song > Delete from Library in a playlist asks, and removes it everywhere",
    (await library(
      page,
      (l) => l.songs.length === 2 && !l.playlists[0].songs.includes(id["Depth Cove"]),
    )) !== null,
  );
  await place(again, "Songs").click();
  await row(again, "Depth Dune").click();
  await chooseMenu(page, "Song", "Delete from Library");
  await page.getByRole("button", { name: "Move to Trash", exact: true }).click();
  step(
    "Move to Trash takes the song out of the library",
    (await library(page, (l) => l.songs.length === 1)) !== null,
  );
  await reloadDesktop(page);
  const last = await openMusic(page);
  await place(last, "Songs").click();
  step(
    "the library is as it was left after a reload",
    (await last.getByRole("row", { name: /Depth/ }).count()) === 1,
  );
  await shot(page, path.join(out, "music-after-reload.png"));

  // ---- Song Info -------------------------------------------------------------------------------
  await place(last, "Songs").click();
  await row(last, "Depth").click();
  await page.keyboard.press(`${COMMAND}+i`);
  const info = page.getByRole("dialog");
  await info.waitFor({ timeout: 5_000 });
  await info.getByRole("textbox", { name: "Song", exact: true }).fill("Renamed Song");
  await info.getByRole("textbox", { name: "Genre", exact: true }).fill("Depth Genre");
  await info.getByRole("textbox", { name: "Year", exact: true }).fill("1999");
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "music-song-info.png"));
  await info.getByRole("button", { name: "OK", exact: true }).click();
  step(
    "Command-I edits a song's details, on the server",
    (await library(page, (l) =>
      l.songs.some(
        (s) => s.title === "Renamed Song" && s.genre === "Depth Genre" && s.year === 1999,
      ),
    )) !== null,
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
    "base64",
  );
  await row(last, "Renamed Song").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Song Info", exact: true }).click();
  await info.waitFor({ timeout: 5_000 });
  await info
    .getByRole("radio", { name: "Artwork" })
    .or(info.getByRole("button", { name: "Artwork", exact: true }))
    .first()
    .click();
  await info
    .locator('input[type="file"]')
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await info.getByRole("img", { name: "The song's artwork" }).waitFor({ timeout: 5_000 });
  await info.getByRole("button", { name: "OK", exact: true }).click();
  step(
    "Song Info's artwork is kept with the song",
    (await library(page, (l) => l.songs.some((s) => s.title === "Renamed Song" && s.artwork))) !==
      null,
  );
  await chooseMenu(page, "Edit", "Undo");
  step(
    "Undo takes the artwork back and keeps the name",
    (await library(page, (l) => l.songs.some((s) => s.title === "Renamed Song" && !s.artwork))) !==
      null,
  );
  const second = path.join(out, "depth-info.wav");
  writeFileSync(second, wav("Depth Second", 5));
  await last.locator('input[type="file"][aria-label="Add to Library"]').setInputFiles(second);
  await library(page, (l) => l.songs.length === 2);
  await row(last, "Depth Second").waitFor({ timeout: 10_000 });
  await row(last, "Depth Second").click();
  await page.keyboard.press(`${COMMAND}+a`);
  await chooseMenu(page, "Song", "Song Info");
  await info.waitFor({ timeout: 5_000 });
  step(
    "Multiple Item Info hides the song's name and marks a field the songs differ in",
    (await info.getByRole("textbox", { name: "Song", exact: true }).count()) === 0 &&
      (await info
        .getByRole("textbox", { name: "Genre", exact: true })
        .getAttribute("placeholder")) === "Mixed",
  );
  await info.getByRole("textbox", { name: "Artist", exact: true }).fill("Everyone");
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "music-multiple-info.png"));
  await info.getByRole("button", { name: "OK", exact: true }).click();
  step(
    "Multiple Item Info changes the field typed in, on every selected song, and nothing else",
    (await library(
      page,
      (l) =>
        l.songs.length === 2 &&
        l.songs.every((s) => s.artist === "Everyone") &&
        l.songs.some((s) => s.title === "Renamed Song" && s.genre === "Depth Genre"),
    )) !== null,
  );

  const selectBoth = async () => {
    await row(last, "Depth Second").click();
    await page.keyboard.press(`${COMMAND}+a`);
    await chooseMenu(page, "Song", "Song Info");
    await info.waitFor({ timeout: 5_000 });
  };
  await selectBoth();
  const mixedGenre = info.getByRole("textbox", { name: "Genre", exact: true });
  await mixedGenre.fill("Typed");
  await mixedGenre.fill("");
  await info.getByRole("button", { name: "OK", exact: true }).click();
  step(
    "a mixed field typed in and cleared empties it on every selected song",
    (await library(
      page,
      (l) => l.songs.every((s) => s.genre === "") && l.songs.every((s) => s.artist === "Everyone"),
    )) !== null,
  );

  await row(last, "Renamed Song").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Song Info", exact: true }).click();
  await info.waitFor({ timeout: 5_000 });
  await info
    .getByRole("radio", { name: "Artwork" })
    .or(info.getByRole("button", { name: "Artwork", exact: true }))
    .first()
    .click();
  await page.evaluate(() => {
    const real = window.createImageBitmap.bind(window);
    window.__slowDecode = 1_500;
    window.createImageBitmap = async (...args) => {
      const wait = window.__slowDecode;
      window.__slowDecode = 0;
      await new Promise((resolve) => setTimeout(resolve, wait));
      return real(...args);
    };
  });
  await info
    .locator('input[type="file"]')
    .setInputFiles({ name: "slow.png", mimeType: "image/png", buffer: png });
  const ok = info.getByRole("button", { name: "OK", exact: true });
  step("OK waits while the chosen picture is being read", await ok.isDisabled());
  await info.getByRole("img", { name: "The song's artwork" }).waitFor({ timeout: 8_000 });
  await ok.click();
  step(
    "the picture chosen is saved once it is read",
    (await library(page, (l) => l.songs.some((s) => s.title === "Renamed Song" && s.artwork))) !==
      null,
  );

  await selectBoth();
  await info
    .getByRole("radio", { name: "Artwork" })
    .or(info.getByRole("button", { name: "Artwork", exact: true }))
    .first()
    .click();
  await info.getByRole("button", { name: "Remove Artwork", exact: true }).click();
  await ok.click();
  step(
    "Remove Artwork reaches a cover on any selected song, not only the first",
    (await library(page, (l) => l.songs.every((s) => !s.artwork))) !== null,
  );

  // ---- Playlist folders -------------------------------------------------------------------------
  await chooseMenu(page, "File", "New", "Playlist Folder");
  const folderId = (await library(page, (l) => l.folders?.length === 1)).folders[0].id;
  const folderName = last.getByRole("textbox").first();
  await folderName.waitFor({ timeout: 5_000 });
  await folderName.fill("Depth Folder");
  await page.keyboard.press("Enter");
  step(
    "New Playlist Folder asks for its name and keeps it",
    (await library(page, (l) => l.folders?.[0]?.name === "Depth Folder")) !== null,
  );
  await place(last, "Songs").click();
  await page.keyboard.press(`${COMMAND}+z`);
  step(
    "Undo gives a renamed folder its name back, and keeps the folder",
    (await library(page, (l) => l.folders?.[0]?.name === "Untitled Folder")) !== null,
  );
  await page.keyboard.press(`${COMMAND}+Shift+z`);
  step(
    "Redo names it again",
    (await library(page, (l) => l.folders?.[0]?.name === "Depth Folder")) !== null,
  );

  const sidebarRow = (name) => last.getByRole("treeitem", { name, exact: true });
  await sidebarRow("Depth Folder").click({ button: "right" });
  await page.getByRole("menuitem", { name: "New Playlist", exact: true }).click();
  const inFolder = await library(page, (l) => l.playlists.some((list) => list.folder === folderId));
  step("a playlist made from the folder's menu sits in it", inFolder !== null);
  const firstSong = inFolder.songs[0].id;

  await sidebarRow("Untitled Playlist").first().dragTo(sidebarRow("Depth Folder"));
  const dragged = await library(
    page,
    (l) => l.playlists.filter((list) => list.folder === folderId).length >= 2,
  );
  step("a playlist dragged onto a folder moves into it", dragged !== null);
  await reloadDesktop(page);
  await openMusic(page);
  await settledShot(page, "music-playlist-folder.png");
  step(
    "the folder and what is in it are kept after a reload",
    (await last.getByRole("treeitem", { name: "Depth Folder", exact: true }).count()) === 1 &&
      (await last.getByRole("group").getByRole("treeitem").count()) >= 2,
  );

  await sidebarRow("Depth Folder").click();
  const list = dragged.playlists.find((one) => one.folder === folderId);
  await place(last, list.name).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();
  step(
    "Duplicate makes a copy of the playlist beside it",
    (await library(page, (l) =>
      l.playlists.some((one) => one.name === `${list.name} copy` && one.folder === folderId),
    )) !== null,
  );
  await page.keyboard.press(`${COMMAND}+z`);
  step(
    "Undo takes the copy back",
    (await library(page, (l) => !l.playlists.some((one) => one.name === `${list.name} copy`))) !==
      null,
  );

  await sidebarRow("Depth Folder").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete from Library", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  const emptied = await library(
    page,
    (l) => !l.folders?.length && l.playlists.every((one) => one.folder == null),
  );
  step(
    "deleting a folder takes its playlists and leaves the songs",
    emptied?.songs.some((s) => s.id === firstSong),
  );
  await page.keyboard.press(`${COMMAND}+z`);
  step(
    "Undo brings the folder back with its playlists",
    (await library(
      page,
      (l) => l.folders?.length === 1 && l.playlists.some((one) => one.folder === folderId),
    )) !== null,
  );

  // ---- Smart playlists -------------------------------------------------------------------------
  await chooseMenu(page, "File", "New", "Smart Playlist…");
  const editor = page.getByRole("dialog", { name: "Smart Playlist" });
  await editor.waitFor({ timeout: 5_000 });
  await editor.getByRole("button", { name: "OK", exact: true }).click();
  step(
    "a rule with no value is refused, saying why",
    await editor.getByRole("alert").getByText("Every rule needs a value.").isVisible(),
  );
  await editor.getByRole("textbox", { name: "Value" }).fill("everyone");
  await editor.getByRole("button", { name: "Add Rule" }).click();
  await editor.getByRole("combobox", { name: "Field" }).nth(1).click();
  await page.getByRole("option", { name: "Year", exact: true }).click();
  await editor.getByRole("combobox", { name: "Condition" }).nth(1).click();
  await page.getByRole("option", { name: "is greater than", exact: true }).click();
  await editor.getByRole("textbox", { name: "Value" }).nth(1).fill("1990");
  await settledShot(page, "music-smart-rules.png");
  await editor.getByRole("button", { name: "OK", exact: true }).click();
  const madeSmart = await library(page, (l) => l.playlists.some((one) => one.smart));
  const smartList = madeSmart.playlists.find((one) => one.smart);
  step(
    "the rules are kept, with no songs of its own",
    smartList.songs.length === 0 && smartList.smart.rules.length === 2 && smartList.smart.all,
  );
  await page.getByRole("grid").or(page.getByRole("table")).first().waitFor({ timeout: 5_000 });
  step(
    "it lists the songs matching all the rules: only the one with a year",
    (await last.getByRole("row", { name: /Renamed Song/ }).count()) === 1 &&
      (await last.getByRole("row", { name: /Depth Second/ }).count()) === 0,
  );
  await settledShot(page, "music-smart-result.png");

  await chooseMenu(page, "File", "Edit Smart Playlist…");
  await editor.waitFor({ timeout: 5_000 });
  await editor.getByRole("combobox", { name: "Match" }).click();
  await page.getByRole("option", { name: "any", exact: true }).click();
  await editor.getByRole("button", { name: "OK", exact: true }).click();
  await library(page, (l) => l.playlists.some((one) => one.smart && !one.smart.all));
  await last.getByRole("row", { name: /Depth Second/ }).waitFor({ timeout: 5_000 });
  step(
    "changing to any of the rules brings in the other song",
    (await last.getByRole("row", { name: /Depth Second/ }).count()) === 1,
  );
  await page.keyboard.press(`${COMMAND}+z`);
  step(
    "Undo gives the rules back",
    (await library(page, (l) => l.playlists.some((one) => one.smart?.all))) !== null,
  );
  await place(last, "Songs").click();
  await row(last, "Renamed Song").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Playlist" }).hover();
  await page.waitForTimeout(400);
  step(
    "a smart playlist is not offered as a place to add songs",
    (await page.getByRole("menuitem", { name: smartList.name, exact: true }).count()) === 0,
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // ---- The remaining row menus -----------------------------------------------------------------
  await place(last, "Songs").click();
  await row(last, "Renamed Song").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rating", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: "★★★★", exact: true }).click();
  const rated = await library(page, (l) => l.songs.some((s) => s.rating === 4));
  step("a song's menu rates it, and the rating is kept", rated !== null);
  await closeMenus(page);
  await page.keyboard.press(`${COMMAND}+z`);
  step(
    "Undo takes a rating back",
    (await library(page, (l) => l.songs.every((s) => !s.rating))) !== null,
  );
  await row(last, "Renamed Song").click();
  await chooseMenu(page, "Song", "Dislike");
  step(
    "Song > Dislike marks the song",
    (await library(page, (l) => l.songs.some((s) => s.title === "Renamed Song" && s.disliked))) !==
      null,
  );
  await chooseMenu(page, "Song", "Undo Dislike");
  step(
    "Song > Undo Dislike takes it back",
    (await library(page, (l) => l.songs.every((s) => !s.disliked))) !== null,
  );
  await row(last, "Renamed Song").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Share Song", exact: true }).hover();
  step(
    "a song on the drive has no link to share, and its row says why",
    (await page
      .getByRole("menuitem", { name: "Copy Link", exact: true })
      .getAttribute("aria-disabled")) === "true",
  );
  await closeMenus(page);
  await row(last, "Renamed Song").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show in Album", exact: true }).click();
  const albumDetail = last.getByRole("region", { name: /Depth Album by Everyone/ });
  await albumDetail.waitFor({ timeout: 5_000 });
  step("Show in Album opens the song's album", await albumDetail.isVisible());

  const albumCard = last.locator("[data-album]").first();
  await albumCard.click({ button: "right" });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "music-album-menu.png"));
  await page.getByRole("menuitem", { name: "Play", exact: true }).click();
  step(
    "an album's menu plays the album",
    (await playback(page, (p) => p.queue?.length >= 2)) !== null,
  );
  await chooseMenu(page, "Controls", "Pause");
  await albumCard.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Play Later", exact: true }).click();
  await last.getByRole("button", { name: "Up Next", exact: true }).click();
  const upcoming = last.getByRole("listbox", { name: "Upcoming songs" }).getByRole("option");
  await upcoming.nth(2).waitFor({ timeout: 5_000 });
  const upNextTitles = await upcoming.allInnerTexts();
  const duplicated = upNextTitles[0] === upNextTitles[2];
  await upcoming.nth(2).click({ button: "right" });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "music-up-next-menu.png"));
  await page.getByRole("menuitem", { name: "Remove from Up Next", exact: true }).click();
  await page.waitForTimeout(300);
  step(
    "Up Next's row menu removes the very row, of a song listed twice",
    duplicated && (await upcoming.allInnerTexts()).join() === upNextTitles.slice(0, 2).join(),
  );
  await last.getByRole("button", { name: "Up Next", exact: true }).click();

  await last.locator(".mac-now-playing-lcd").click({ button: "right", position: { x: 40, y: 20 } });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "music-now-playing-menu.png"));
  await page.getByRole("menuitem", { name: "Song Info", exact: true }).click();
  step(
    "the Now Playing display's menu opens Song Info",
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).isVisible(),
  );
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await chooseMenu(page, "Controls", "Stop");

  // ---- Equalizer -------------------------------------------------------------------------------
  await page.addInitScript(() => {
    window.__eqFilters = [];
    window.__analysers = [];
    const filter = AudioContext.prototype.createBiquadFilter;
    AudioContext.prototype.createBiquadFilter = function () {
      const made = filter.call(this);
      window.__eqFilters.push(made);
      return made;
    };
    const analyser = AudioContext.prototype.createAnalyser;
    AudioContext.prototype.createAnalyser = function () {
      const made = analyser.call(this);
      window.__analysers.push(made);
      return made;
    };
  });
  await reloadDesktop(page);
  await openMusic(page);
  await chooseMenu(page, "Window", "Equalizer");
  const eq = page.getByRole("region", { name: "Equalizer" });
  await eq.waitFor({ timeout: 5_000 });
  await eq.getByRole("combobox", { name: "Preset" }).click();
  await page.getByRole("option", { name: "Bass Booster", exact: true }).click();
  step(
    "choosing a preset turns the Equalizer on",
    await eq.getByRole("checkbox", { name: "On" }).isChecked(),
  );
  await place(last, "Songs").click();
  await row(last, "Renamed Song").dblclick();
  await page.waitForFunction(() => window.__eqFilters?.length === 10, null, { timeout: 8_000 });
  const measure = () =>
    page.evaluate(() => {
      const data = new Uint8Array(window.__analysers[0].frequencyBinCount);
      window.__analysers[0].getByteFrequencyData(data);
      return {
        state: window.__analysers[0].context.state,
        level: data.reduce((sum, value) => sum + value, 0),
        low: window.__eqFilters[0].gain.value,
      };
    });
  // Sound takes its time to arrive: the song still has to load from the drive.
  await until(async () => (await measure()).level > 0, 15_000);
  const sound = await measure();
  step(
    "the song plays through the Equalizer: sound reaches the end of it, with the preset's gain",
    sound.state === "running" && sound.level > 0 && sound.low === 5.5,
    JSON.stringify(sound),
  );
  await settledShot(page, "music-equalizer.png");
  await eq.getByRole("checkbox", { name: "On" }).click();
  await page.waitForTimeout(200);
  step(
    "turned off, its gains are flat and the sound goes on",
    await page.evaluate(() => window.__eqFilters.every((filter) => filter.gain.value === 0)),
  );
  await eq.getByRole("checkbox", { name: "On" }).click();
  await eq.getByRole("slider", { name: "1K" }).focus();
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(200);
  step(
    "moving a band changes that band's gain, and the preset becomes Manual",
    (await page.evaluate(() => window.__eqFilters[5].gain.value)) === 0.5 &&
      (await eq.getByRole("combobox", { name: "Preset" }).innerText()).includes("Manual"),
  );
  await page.waitForFunction(() => window.__eqFilters[5]?.gain.value === 0.5, null, {
    timeout: 3_000,
  });
  await page.waitForTimeout(3_000);
  await reloadDesktop(page);
  await openMusic(page);
  await chooseMenu(page, "Window", "Equalizer");
  await eq.waitFor({ timeout: 5_000 });
  const eqKept = async () =>
    (await eq.getByRole("slider", { name: "1K" }).inputValue()) === "0.5" &&
    (await eq.getByRole("checkbox", { name: "On" }).isChecked());
  for (let wait = 0; wait < 20 && !(await eqKept()); wait += 1) await page.waitForTimeout(250);
  step(
    "the Equalizer's settings are kept across a reload",
    await eqKept(),
    `1K ${await eq.getByRole("slider", { name: "1K" }).inputValue()}, on ${await eq.getByRole("checkbox", { name: "On" }).isChecked()}`,
  );
  await eq.getByRole("checkbox", { name: "On" }).click();
  await page.waitForTimeout(600);
  await chooseMenu(page, "Window", "Close Equalizer");
  await chooseMenu(page, "Controls", "Stop");

  // ---- Visualizer ------------------------------------------------------------------------------
  await place(last, "Songs").click();
  await row(last, "Renamed Song").dblclick();
  await chooseMenu(page, "View", "Show Visualizer");
  const drawing = last.getByRole("img", { name: /^Visualizer: / });
  await drawing.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_200);
  await shot(page, path.join(out, "music-visualizer.png"));
  const painted = () =>
    drawing.evaluate((canvas) => {
      const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      const colours = new Set();
      for (let at = 0; at < data.length; at += 4096) {
        colours.add(`${data[at]},${data[at + 1]},${data[at + 2]}`);
      }
      return colours.size;
    });
  step("the Visualizer draws while the song plays", (await painted()) > 3);
  step(
    "and the sound reaches its analyser",
    await until(
      () =>
        page.evaluate(() => {
          const analyser = window.__analysers.at(-1);
          const data = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(data);
          return data.some((value) => value > 0);
        }),
      15_000,
    ),
  );
  await chooseMenu(page, "Window", "Visualizer");
  await row(last, "Renamed Song").waitFor({ timeout: 5_000 });
  step(
    "hiding it brings the list back, and the song plays on",
    (await drawing.count()) === 0 &&
      (await last.getByRole("button", { name: "Pause", exact: true }).count()) === 1,
  );
  await chooseMenu(page, "Controls", "Stop");

  // ---- View Options, Sort By, the status bar ----------------------------------------------------
  await place(last, "Songs").click();
  await chooseMenu(page, "View", "Show View Options");
  const viewOptions = page.getByRole("dialog", { name: "View Options" });
  await viewOptions.waitFor({ timeout: 5_000 });
  await viewOptions.getByRole("checkbox", { name: "Year", exact: true }).click();
  await viewOptions.getByRole("checkbox", { name: "Genre", exact: true }).click();
  await viewOptions.getByRole("combobox", { name: "Sort By" }).click();
  await page.getByRole("option", { name: "Year", exact: true }).click();
  await viewOptions.getByRole("combobox", { name: "Sort Order" }).click();
  await page.getByRole("option", { name: "Descending", exact: true }).click();
  await settledShot(page, "music-view-options.png");
  await viewOptions.getByRole("button", { name: "Done", exact: true }).click();
  const headings = () => last.getByRole("columnheader").allInnerTexts();
  const songAtTop = async () => last.locator("[data-song]").first().innerText();
  step(
    "View Options shows Year, hides Genre",
    (await headings()).includes("Year") && !(await headings()).includes("Genre"),
  );
  step("and sorts by Year, newest first", (await songAtTop()).includes("Renamed Song"));
  await chooseMenu(page, "View", "Sort By", "Ascending");
  await page.waitForTimeout(250);
  await closeMenus(page);
  step("View > Sort By turns the order over", (await songAtTop()).includes("Depth Second"));
  await chooseMenu(page, "View", "Show Status Bar");
  step(
    "the status bar counts the songs listed",
    await last
      .getByRole("status")
      .getByText(/^2 songs,/)
      .isVisible(),
  );
  await page.waitForTimeout(3_000);
  await reloadDesktop(page);
  await openMusic(page);
  await place(last, "Songs").click();
  await last.getByRole("columnheader", { name: "Year" }).waitFor({ timeout: 5_000 });
  await last
    .getByRole("status")
    .getByText(/^2 songs,/)
    .waitFor({ timeout: 5_000 });
  step(
    "the columns, sort and status bar are kept across a reload",
    !(await headings()).includes("Genre") &&
      (await songAtTop()).includes("Depth Second") &&
      (await last
        .getByRole("status")
        .getByText(/^2 songs,/)
        .count()) === 1,
  );
  await chooseMenu(page, "View", "Hide Status Bar");

  // ---- A failed Internet Archive item offers Try Again ----------------------------------------
  await place(last, "Browse").click();
  const card = last.locator(".mac-music-page button[aria-pressed]").first();
  await card.waitFor({ timeout: 25_000 });
  let failItem = true;
  await page.route("**/api/music/archive/item/**", (route) => {
    if (!failItem) return route.continue();
    failItem = false;
    expectRefusal(503, new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "The Internet Archive is not answering." }),
    });
  });
  await card.click();
  const itemPanel = last.locator(".mac-music-album");
  const tryAgain = itemPanel.getByRole("button", { name: "Try Again", exact: true });
  await tryAgain.waitFor({ timeout: 15_000 });
  await settledShot(page, "music-archive-try-again.png");
  await tryAgain.click();
  await itemPanel.getByRole("alert").waitFor({ state: "detached", timeout: 25_000 });
  await itemPanel.getByRole("status").waitFor({ state: "detached", timeout: 25_000 });
  const itemTitle = (await card.innerText()).split("\n")[0].trim();
  step(
    "Try Again shows the item that failed, with its tracks",
    (await itemPanel.getAttribute("aria-label")) === itemTitle &&
      (await itemPanel.getByRole("row").count()) > 0,
    `${await itemPanel.getAttribute("aria-label")} / ${itemTitle}`,
  );
  step(
    "Try Again reads the failed Internet Archive item again",
    (await itemPanel.getByRole("button", { name: "Try Again", exact: true }).count()) === 0,
  );
  await page.unroute("**/api/music/archive/item/**");

  // ---- Dragging songs ------------------------------------------------------------------------
  const centre = async (locator) => {
    const box = await locator.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const dragTo = async (from, to) => {
    const a = await centre(from);
    const b = await centre(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 10, a.y + 10, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 12 });
  };
  const [fir, gale] = ["Depth Fir", "Depth Gale"].map((title, index) => {
    const file = path.join(out, `depth-drag-${index}.wav`);
    writeFileSync(file, wav(title, index + 5));
    return file;
  });
  const before = (await read(page, LIBRARY, "library")).songs.length;
  await last.locator('input[type="file"][aria-label="Add to Library"]').setInputFiles([fir, gale]);
  const grown = await library(page, (l) => l.songs.length === before + 2);
  const songId = (title) => grown.songs.find((song) => song.title === title)?.id;
  await chooseMenu(page, "File", "New", "Playlist");
  const made2 = await library(page, (l) => l.playlists.length === grown.playlists.length + 1);
  const mix = made2.playlists.at(-1);
  await place(last, "Songs").click();
  await dragTo(row(last, "Depth Fir"), place(last, mix.name));
  await settledShot(page, "music-drag-to-playlist.png");
  await page.mouse.up();
  step(
    "a song dragged to a playlist in the sidebar joins it",
    (await library(page, (l) => l.playlists.at(-1)?.songs.includes(songId("Depth Fir")))) !== null,
  );
  await dragTo(row(last, "Depth Gale"), place(last, "Loved Songs"));
  await page.mouse.up();
  step(
    "a song dragged to Loved Songs is loved",
    (await library(page, (l) => l.loved.includes(songId("Depth Gale")))) !== null,
  );
  await row(last, "Depth Fir").click();
  await row(last, "Depth Gale").click({ modifiers: [COMMAND] });
  await dragTo(row(last, "Depth Gale"), place(last, mix.name));
  step(
    "two selected songs drag as one, counted",
    (await page.locator(".mac-desktop-drag-count").textContent()) === "2",
  );
  await page.mouse.up();
  step(
    "both join the playlist, the one it held not twice",
    (await library(page, (l) => l.playlists.at(-1)?.songs.length === 2)) !== null,
  );
  await place(last, mix.name).click();
  await dragTo(row(last, "Depth Gale"), row(last, "Depth Fir"));
  await page.mouse.up();
  const reordered = await library(
    page,
    (l) => l.playlists.at(-1)?.songs[0] === songId("Depth Gale"),
  );
  step("a song dragged between a playlist's rows moves there", reordered !== null);
  await settledShot(page, "music-playlist-reordered.png");
  await last.getByRole("columnheader", { name: "Title" }).click();
  await dragTo(row(last, "Depth Gale"), row(last, "Depth Fir"));
  await page.mouse.up();
  await page.waitForTimeout(800);
  step(
    "sorted by a column, a drag between rows leaves the playlist's order alone",
    (await read(page, LIBRARY, "library")).playlists.at(-1)?.songs[0] === songId("Depth Gale"),
  );
  await last.getByRole("button", { name: "Up Next", exact: true }).click();
  await dragTo(row(last, "Depth Fir"), last.locator('[data-music-panel="up-next"]'));
  await page.mouse.up();
  step(
    "a song dragged to Up Next joins it",
    (await playback(page, (p) => p.queue.includes(songId("Depth Fir")))) !== null,
  );
  await settledShot(page, "music-up-next-drag.png");

  // ---- Finder: a sound file opens in Music, and drags into it ---------------------------------
  const driveEntries = (await api(page, "GET", "/api/files/")).json.entries;
  const loose = driveEntries.filter(
    (entry) => /^depth-[0-3]\.wav$/.test(entry.name) && !entry.trashed_ms,
  );
  await api(page, "POST", "/api/files/ops", {
    ops: loose.map((entry) => ({ op: "move", id: entry.id, parent: "documents" })),
  });
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  const finder = page.locator(".mac-window.mac-finder").first();
  await finder.waitFor({ timeout: 10_000 });
  await finder.getByRole("treeitem", { name: "Documents", exact: true }).first().click();
  const loaded = (await read(page, LIBRARY, "library")).songs.length;
  const looseFile = (name) => finder.getByRole("option", { name, exact: true }).first();
  await looseFile(loose[0].name).waitFor({ timeout: 10_000 });
  await looseFile(loose[0].name).dblclick();
  const opened = await library(page, (l) => l.songs.length === loaded + 1);
  step("double-clicking a sound file in Finder adds it to Music", opened !== null);
  step(
    "and plays it",
    (await playback(page, (p) => p.queue[p.index] === opened?.songs.at(-1)?.id)) !== null,
  );
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  await finder.waitFor({ timeout: 10_000 });
  await looseFile(loose[0].name).dblclick();
  await page.waitForTimeout(800);
  step(
    "opening it again plays the song, without a second copy",
    (await read(page, LIBRARY, "library")).songs.length === loaded + 1,
  );
  await page.getByRole("toolbar", { name: "Dock" }).getByRole("button", { name: "Finder" }).click();
  if (loose[1]) {
    await dragTo(looseFile(loose[1].name), page.locator('.mac-dock [data-dock-target="music"]'));
    step(
      "Music's Dock tile accepts a sound file",
      (await page
        .locator('.mac-dock [data-dock-target="music"]')
        .getAttribute("data-desktop-drop")) === "accept",
    );
    await page.mouse.up();
    step("and adds it", (await library(page, (l) => l.songs.length === loaded + 2)) !== null);
  }
  await shot(page, path.join(out, "music-from-finder.png"));
});
// The census kit's import keeps the process alive once the run has passed.
process.exit(0);

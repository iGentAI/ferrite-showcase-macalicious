#!/usr/bin/env node
// Music's File > Library: Export Playlist and Export Library write files to the drive, Import
// Playlist reads one back, Show Duplicate Items lists the same song twice, Song > Show in Playlist
// goes to the playlist, and File > Print puts the list on paper. The songs are real files imported
// through the window; the playlist they start in is written through the library's API.
//
//   node e2e/music-files-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("music-files", { ignoreOtherOrigins: true });

const LIBRARY = "/api/music/library";

/** A short mono WAV naming its song in a RIFF INFO list. */
function wav(title) {
  const rate = 8_000;
  const pcm = Buffer.alloc(rate * 2);
  for (let i = 0; i < pcm.length / 2; i += 1)
    pcm.writeInt16LE(Math.round(Math.sin(i / 8) * 2000), i * 2);
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
    chunk("IART", text("Trees")),
    chunk("IPRD", text("Woods")),
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

const status = (page) => page.locator(".mac-music-desktop-status");
const sourceRow = (page, name) => page.getByRole("treeitem", { name, exact: true }).first();
const rowNamed = (page, title) => page.getByRole("row", { name: new RegExp(title) }).first();
const readLibrary = async (page) => (await api(page, "GET", LIBRARY)).json?.library;

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Music");
  const musicWindow = page.getByRole("region", { name: "Music", exact: true }).first();
  await musicWindow.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await musicWindow.elementHandle(),
    { timeout: 15_000 },
  );
  const input = page.locator('input[type="file"][aria-label="Add to Library"]');
  await input.waitFor({ state: "attached", timeout: 15_000 });
  const files = ["Fir", "Ash", "fir"].map((title, index) => {
    const file = path.join(out, `music-files-${index}.wav`);
    writeFileSync(file, wav(title));
    return file;
  });
  await input.setInputFiles(files);
  step(
    "three songs are imported",
    await until(async () => (await readLibrary(page))?.songs?.length === 3, 20_000),
  );
  const added = await api(page, "GET", LIBRARY);
  const idOf = (title) => added.json.library.songs.find((song) => song.title === title).id;
  const expected = [idOf("Ash"), idOf("Fir")];
  const seed = await api(page, "PUT", LIBRARY, {
    library: {
      ...added.json.library,
      playlists: [{ id: "pl-road", name: "Road Trip", songs: expected }],
    },
    rev: added.json.rev,
  });
  step("a playlist of two of them is seeded", seed.status < 300, String(seed.status));
  await reloadDesktop(page);
  await launch(page, "Music");
  await sourceRow(page, "Road Trip").waitFor({ timeout: 15_000 });

  // ---- Export Playlist, then Import Playlist reads it back ------------------------------------
  await sourceRow(page, "Road Trip").click();
  await chooseMenu(page, "File", "Library", "Export Playlist…");
  await status(page)
    .getByText(/^Saved as/)
    .waitFor({ timeout: 10_000 });
  const said = await status(page).innerText();
  step("Export Playlist says where the file went", /Road Trip\.m3u/.test(said), said);
  await status(page).getByRole("button", { name: "OK" }).click();

  await chooseMenu(page, "File", "Library", "Import Playlist…");
  const panel = page.locator(".mac-music-panel-layer");
  await panel.waitFor({ timeout: 5_000 });
  await panel.getByText("Downloads", { exact: true }).first().click();
  await panel.getByText("Road Trip.m3u", { exact: true }).first().click();
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "music-import-playlist.png"));
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await panel.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Import Playlist makes a playlist of the same songs, in the same order",
    await until(async () => {
      const lists = (await readLibrary(page))?.playlists ?? [];
      const made = lists.filter((list) => list.name === "Road Trip");
      return made.length === 2 && made[1].songs.join() === expected.join();
    }, 8_000),
  );

  // ---- Export Library ----------------------------------------------------------------------------
  await chooseMenu(page, "File", "Library", "Export Library…");
  await status(page)
    .getByText(/^Saved as/)
    .waitFor({ timeout: 10_000 });
  step(
    "Export Library says where the file went",
    /Library\.xml/.test(await status(page).innerText()),
  );
  const savedAs = /“(.*)”/.exec(await status(page).innerText())?.[1] ?? "";
  await status(page).getByRole("button", { name: "OK" }).click();

  const stored = await page.evaluate(async (name) => {
    const drive = await (await fetch("/api/files", { credentials: "same-origin" })).json();
    const downloads = drive.entries.find(
      (entry) => entry.name === "Downloads" && entry.parent === undefined,
    );
    const file = drive.entries.find(
      (entry) => entry.name === name && entry.parent === downloads?.id,
    );
    if (!file) return "";
    const version = file.version ?? 0;
    const content = await fetch(
      `/api/files/content/${file.id}?piece=0&count=8&version=${version}`,
      {
        credentials: "same-origin",
      },
    );
    return content.text();
  }, savedAs);
  step(
    "the file kept on the drive holds the songs and the playlists",
    stored.includes("<key>Name</key><string>Ash</string>") &&
      stored.includes("<key>Name</key><string>Road Trip</string>"),
    stored.slice(0, 80),
  );
  // ---- Show Duplicate Items ------------------------------------------------------------------------
  await chooseMenu(page, "File", "Library", "Show Duplicate Items");
  const heading = page.getByRole("heading", { name: "Duplicate Items" });
  await heading.waitFor({ timeout: 5_000 });
  const count = () => page.getByRole("grid", { name: "Duplicate Items" }).getByRole("row").count();
  step(
    "Show Duplicate Items lists the two songs that are the same",
    (await count()) === 3,
    String(await count()),
  );
  await shot(page, path.join(out, "music-duplicates.png"));
  await page.getByRole("button", { name: "Show All Items" }).click();
  step(
    "Show All Items goes back to every song",
    await until(async () => !(await heading.isVisible()), 3_000),
  );

  // ---- Song > Show in Playlist ---------------------------------------------------------------------
  await sourceRow(page, "Songs").click();
  await rowNamed(page, "Ash").click();
  const showIn = await menuItemState(page, "Song", "Show in Playlist");
  step(
    "Show in Playlist is offered for a song in a playlist",
    showIn.disabled !== true,
    JSON.stringify(showIn),
  );
  await chooseMenu(page, "Song", "Show in Playlist", "Road Trip");
  step(
    "Show in Playlist goes to the playlist, with the song chosen",
    await until(
      async () =>
        (await page.getByRole("heading", { name: "Road Trip" }).count()) > 0 &&
        (await rowNamed(page, "Ash").getAttribute("aria-selected")) === "true",
      5_000,
    ),
  );

  // ---- File > Print ----------------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__printed = null;
    const seen = new MutationObserver(() => {
      const frame = document.querySelector("iframe[data-music-print]");
      if (frame && !window.__printed) window.__printed = frame.srcdoc;
    });
    seen.observe(document.body, { childList: true });
  });
  await chooseMenu(page, "File", "Print…");
  const printed = () => page.evaluate(() => window.__printed);
  step(
    "Print puts the list on a page of its own",
    await until(async () => /<h1>Road Trip<\/h1>/.test((await printed()) ?? ""), 5_000),
  );

  // ---- Open Stream has a window now, not a reason -------------------------------------------------------
  const openStream = await menuItemState(page, "File", "Open Stream…");
  step("Open Stream is offered", !openStream.disabled);

  await reloadDesktop(page);
  await launch(page, "Music");
  await sourceRow(page, "Road Trip").first().waitFor({ timeout: 15_000 });
  step(
    "over a reload the imported playlist stays",
    ((await readLibrary(page))?.playlists ?? []).filter((list) => list.name === "Road Trip")
      .length === 2,
  );
});

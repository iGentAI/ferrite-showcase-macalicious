#!/usr/bin/env node
// Music's fuller commands, in the running app: Song Info's Lyrics, Options and Sorting, the Lyrics
// panel, Up Next's History, Shuffle by Albums, the Preferences for ratings and checkboxes, Downloaded
// and Only Downloaded Music, Music Videos, Organize Library, the search scope, type to select, an
// artist's menu, Apple's dimmed sidebar rows and the MiniPlayer kept on top. The songs are real files
// imported through the window; each change is read back from the server.
//
//   node e2e/music-batch-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("music-batch", { ignoreOtherOrigins: true });

const LIBRARY = "/api/music/library";

/** A short mono WAV naming its song in a RIFF INFO list. */
function wav(title, artist, album) {
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

const sourceRow = (page, name) => page.getByRole("treeitem", { name, exact: true }).first();
const rowNamed = (page, title) => page.getByRole("row", { name: new RegExp(title) }).first();
const readDoc = async (page, url, field) => (await api(page, "GET", url)).json?.[field];
const readLibrary = (page) => readDoc(page, LIBRARY, "library");
const pane = (page, name) => page.getByRole("dialog").getByText(name, { exact: true }).first();

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Music");
  const music = page.getByRole("region", { name: "Music", exact: true }).first();
  await music.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await music.elementHandle(),
    {
      timeout: 15_000,
    },
  );
  const input = page.locator('input[type="file"][aria-label="Add to Library"]');
  await input.waitFor({ state: "attached", timeout: 15_000 });
  const files = [
    ["Fir", "Trees", "Woods"],
    ["Ash", "Trees", "Woods"],
    ["Kelp", "Seas", "Tide"],
  ].map((tags, index) => {
    const file = path.join(out, `music-batch-${index}.wav`);
    writeFileSync(file, wav(...tags));
    return file;
  });
  await input.setInputFiles(files);
  step(
    "three songs are imported",
    await until(async () => (await readLibrary(page))?.songs?.length === 3, 20_000),
  );

  // ---- The sidebar: dimmed services, Downloaded, Music Videos ---------------------------------
  for (const name of ["For You", "iTunes Store"]) {
    const row = sourceRow(page, name);
    step(
      `${name} is dimmed, saying why`,
      (await row.getAttribute("aria-disabled")) === "true" &&
        /not part of this desktop/.test((await row.getAttribute("title")) ?? ""),
    );
  }
  await shot(page, path.join(out, "music-batch-sidebar.png"));
  await sourceRow(page, "Downloaded").click();
  const downloaded = page.getByRole("grid", { name: "Downloaded" });
  await downloaded.waitFor({ timeout: 5_000 });
  step("Downloaded lists the songs on the drive", (await downloaded.getByRole("row").count()) >= 3);
  await shot(page, path.join(out, "music-batch-downloaded.png"));
  await sourceRow(page, "Music Videos").click();
  step(
    "Music Videos says where videos come from",
    await page.getByText("Videos in the Music folder of your drive are listed here.").isVisible(),
  );
  await shot(page, path.join(out, "music-batch-videos.png"));

  // ---- Only Downloaded Music ------------------------------------------------------------------
  await sourceRow(page, "Songs").click();
  await chooseMenu(page, "View", "Only Downloaded Music");
  step(
    "Only Downloaded Music keeps the songs on the drive, and is kept",
    (await rowNamed(page, "Fir").isVisible()) &&
      (await menuItemState(page, "View", "Only Downloaded Music")) !== null,
  );
  await chooseMenu(page, "View", "Only Downloaded Music");

  // ---- Type to select -------------------------------------------------------------------------
  await rowNamed(page, "Ash").click();
  await page.keyboard.type("ke");
  step(
    "typing the first letters selects that song",
    await until(
      async () => (await rowNamed(page, "Kelp").getAttribute("aria-selected")) === "true",
      3_000,
    ),
  );

  // ---- Song Info ------------------------------------------------------------------------------
  await rowNamed(page, "Fir").click();
  await chooseMenu(page, "Song", "Song Info");
  await page.getByLabel("Grouping").fill("Morning");
  await pane(page, "Options").click();
  await page.getByLabel("Start").fill("0:01");
  await page.getByRole("checkbox", { name: "Skip when shuffling" }).click();
  step(
    "Remember playback position can be ticked",
    await page.getByRole("checkbox", { name: "Remember playback position" }).isEnabled(),
  );
  await shot(page, path.join(out, "music-batch-options.png"));
  await pane(page, "Sorting").click();
  await page.getByLabel("Sort Name").fill("Zz Fir");
  await shot(page, path.join(out, "music-batch-sorting.png"));
  await pane(page, "Lyrics").click();
  await page.getByRole("textbox", { name: "Lyrics" }).fill("First line\nSecond line");
  await shot(page, path.join(out, "music-batch-lyrics-pane.png"));
  await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();
  step(
    "Song Info's fields are kept on the server",
    await until(async () => {
      const fir = (await readLibrary(page))?.songs?.find((song) => song.title === "Fir");
      return (
        fir?.grouping === "Morning" &&
        fir?.start === 1 &&
        fir?.skipShuffle === true &&
        fir?.sortName === "Zz Fir"
      );
    }, 6_000),
  );
  step(
    "the lyrics are kept on the server",
    await until(async () => {
      const lyrics = await readDoc(page, "/api/music/lyrics", "lyrics");
      return Object.values(lyrics ?? {}).includes("First line\nSecond line");
    }, 6_000),
  );
  const sorted = await page.getByRole("grid", { name: "Songs" }).getByRole("row").allInnerTexts();
  step("the list sorts by the sort name", /Fir/.test(sorted.at(-1) ?? ""), sorted.at(-1));

  // ---- The Lyrics panel and History, on a song that plays -------------------------------------
  await rowNamed(page, "Fir").dblclick();
  await music.getByRole("button", { name: "Lyrics", exact: true }).click();
  const lyricsPanel = page.locator('[data-music-panel="lyrics"]');
  step(
    "the Lyrics panel shows the lyrics of the song playing",
    await lyricsPanel.getByText("Second line").isVisible(),
  );
  await shot(page, path.join(out, "music-batch-lyrics-panel.png"));
  await music.getByRole("button", { name: "Up Next", exact: true }).click();
  const upNext = page.locator('[data-music-panel="up-next"]');
  await upNext.getByText("History", { exact: true }).click();
  step("Up Next's History lists the song played", await upNext.getByText("Fir").isVisible());
  await shot(page, path.join(out, "music-batch-history.png"));
  await upNext.getByRole("button", { name: "Clear" }).click();
  step("Clear empties History", await upNext.getByText("No History").isVisible());
  await music.getByRole("button", { name: "Up Next", exact: true }).click();

  // ---- Shuffle by Albums ----------------------------------------------------------------------
  await chooseMenu(page, "Controls", "Shuffle", "Albums");
  step(
    "Shuffle by Albums is kept with the playback",
    await until(
      async () => (await readDoc(page, "/api/music/playback", "playback"))?.shuffleBy === "albums",
      6_000,
    ),
  );

  // ---- Preferences: ratings and checkboxes ----------------------------------------------------
  await page.keyboard.press("Control+,");
  await page.getByRole("checkbox", { name: "Songs list checkboxes" }).click();
  await page.getByRole("checkbox", { name: "Star ratings" }).click();
  await shot(page, path.join(out, "music-batch-preferences.png"));
  await page.getByRole("button", { name: "OK" }).first().click();
  step(
    "the two settings are kept on the server",
    await until(async () => {
      const kept = await readDoc(page, "/api/music/preferences", "preferences");
      return kept?.songCheckboxes === true && kept?.starRatings === false;
    }, 6_000),
  );
  const box = page.getByRole("checkbox", { name: "Play Ash" });
  await box.waitFor({ timeout: 5_000 });
  await box.click();
  step(
    "a cleared checkbox is kept on the song",
    await until(async () => {
      const ash = (await readLibrary(page))?.songs?.find((song) => song.title === "Ash");
      return ash?.unchecked === true;
    }, 6_000),
  );
  await shot(page, path.join(out, "music-batch-checkboxes.png"));

  // ---- The search scope -----------------------------------------------------------------------
  await page.getByRole("searchbox").first().fill("kelp");
  await page.getByRole("radio", { name: "Library" }).waitFor({ timeout: 3_000 });
  await shot(page, path.join(out, "music-batch-scope.png"));
  await page.getByRole("radio", { name: "Internet Archive" }).click();
  step(
    "the scope bar turns the search to the Internet Archive",
    await page
      .getByRole("searchbox", { name: "Search the Internet Archive" })
      .or(page.getByRole("textbox", { name: "Search the Internet Archive" }))
      .first()
      .isVisible(),
  );

  // ---- An artist's menu -----------------------------------------------------------------------
  await sourceRow(page, "Artists").click();
  await page.getByRole("heading", { name: "Seas", exact: true }).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Seas" });
  await menu.waitFor({ timeout: 3_000 });
  await shot(page, path.join(out, "music-batch-artist-menu.png"));
  await menu.getByRole("menuitem", { name: "Love" }).click();
  step(
    "Love on an artist's heading loves the artist's songs",
    await until(async () => {
      const library = await readLibrary(page);
      const kelp = library?.songs?.find((song) => song.title === "Kelp");
      return library?.loved?.length === 1 && library.loved[0] === kelp?.id;
    }, 6_000),
  );

  // ---- Organize Library -----------------------------------------------------------------------
  await sourceRow(page, "Songs").click();
  await chooseMenu(page, "File", "Library", "Organize Library…");
  await page.getByRole("checkbox", { name: /Reorganize files/ }).click();
  await shot(page, path.join(out, "music-batch-organize.png"));
  await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();
  const status = page.locator(".mac-music-desktop-status");
  await status.getByText(/Organized 3 song files/).waitFor({ timeout: 20_000 });
  step(
    "Reorganize names each file by its track and title, and the library follows",
    await until(async () => {
      const kelp = (await readLibrary(page))?.songs?.find((song) => song.title === "Kelp");
      return kelp?.source?.name === "Kelp.wav";
    }, 6_000),
  );
  const drive = (await api(page, "GET", "/api/files/")).json;
  const entries = drive?.entries ?? [];
  const folder = (name) => entries.find((each) => each.name === name && each.kind === "folder");
  step(
    "the files stand in folders by artist and album",
    Boolean(
      folder("Seas") &&
        folder("Tide")?.parent === folder("Seas")?.id &&
        entries.some((each) => each.name === "Kelp.wav" && each.parent === folder("Tide")?.id),
    ),
    JSON.stringify(entries.filter((each) => ["Seas", "Tide", "Kelp.wav"].includes(each.name))),
  );
  await status.getByRole("button", { name: "OK" }).click();
  await chooseMenu(page, "File", "Library", "Organize Library…");
  await page.getByRole("checkbox", { name: /Reorganize files/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "OK" }).click();
  await status.getByText(/already organized/).waitFor({ timeout: 20_000 });
  step("Organize Library run again leaves the files where they are", true);
  await status.getByRole("button", { name: "OK" }).click();

  // ---- The song plays after its file moved ----------------------------------------------------
  await rowNamed(page, "Kelp").dblclick();
  step(
    "a song whose file moved still plays",
    await until(
      async () => music.getByRole("button", { name: "Pause", exact: true }).isVisible(),
      10_000,
    ),
  );

  // ---- The MiniPlayer kept on top -------------------------------------------------------------
  await page.keyboard.press("Control+,");
  await page.getByRole("tab", { name: "Advanced" }).click();
  await page.getByRole("checkbox", { name: "Keep on top of all other windows" }).click();
  await page.getByRole("button", { name: "OK", exact: true }).filter({ visible: true }).click();
  await music.getByRole("button", { name: "MiniPlayer", exact: true }).click();
  const mini = page.getByRole("region", { name: "MiniPlayer" }).first();
  await mini.waitFor({ timeout: 5_000 });
  step(
    "the MiniPlayer stands above every window",
    (await mini.evaluate((element) => Number(getComputedStyle(element).zIndex))) >= 100_000,
  );
  await launch(page, "Calculator");
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "music-batch-on-top.png"));
  const covering = await mini.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return Boolean(
      element.contains(
        document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2),
      ),
    );
  });
  step("another app brought forward does not cover it", covering);

  await reloadDesktop(page);
});

#!/usr/bin/env node
// Music's Library views: the Genres row, the Column Browser narrowing Songs and its setting kept over
// a reload, and ⌥⌘F taking the search field. The songs are real WAV files imported through the window.
//
//   node e2e/music-browser-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("music-browser", { ignoreOtherOrigins: true });
const LIBRARY = "/api/music/library";
const SETTINGS = "/api/system-preferences/settings";

function wav(title, artist, album, genre) {
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
    chunk("IGNR", text(genre)),
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

const place = (page, name) => page.getByRole("treeitem", { name, exact: true }).first();
const column = (page, name) =>
  page.getByRole("group", { name: "Column Browser" }).getByRole("listbox", { name });
const songRows = (page) =>
  page.getByRole("grid", { name: "Songs" }).locator('[role="row"][aria-rowindex]');
const songTitles = async (page) => {
  const text = await page.getByRole("grid", { name: "Songs" }).innerText();
  return ["Fir", "Ash", "Oak"].filter((title) => text.includes(title));
};

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Music");
  const window = page.getByRole("region", { name: "Music", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  const files = [
    ["Fir", "Pine", "Woods", "Folk"],
    ["Ash", "Elm", "Hills", "Folk"],
    ["Oak", "Pine", "Night", "Jazz"],
  ].map((tags, index) => {
    const file = path.join(out, `music-browser-${index}.wav`);
    writeFileSync(file, wav(...tags));
    return file;
  });
  await window.locator('input[type="file"][aria-label="Add to Library"]').setInputFiles(files);
  step(
    "three songs are imported, with their genres",
    await until(async () => {
      const library = (await api(page, "GET", LIBRARY)).json?.library;
      return (
        library?.songs?.length === 3 &&
        library.songs.filter((song) => song.genre === "Folk").length === 2
      );
    }, 20_000),
    JSON.stringify(
      (await api(page, "GET", LIBRARY)).json?.library?.songs?.map((song) => song.genre),
    ),
  );

  // ---- Genres ------------------------------------------------------------------------------------
  await place(page, "Genres").click();
  const groupHeading = (name) => window.getByRole("heading", { name, exact: true });
  step(
    "Genres groups the albums under each genre",
    await until(
      async () =>
        (await groupHeading("Folk").count()) > 0 && (await groupHeading("Jazz").count()) > 0,
      5_000,
    ),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "music-genres.png"));

  // ---- Column Browser ----------------------------------------------------------------------------
  const offSongs = await menuItemState(page, "View", "Show Column Browser");
  step("away from Songs the Column Browser is dimmed", offSongs.disabled === true);
  await place(page, "Songs").click();
  await chooseMenu(page, "View", "Show Column Browser");
  const genres = column(page, "Genres");
  await genres.waitFor({ timeout: 5_000 });
  step("Column Browser shows three columns", (await column(page, "Albums").count()) === 1);
  step("at first every song is listed", (await songTitles(page)).length === 3);

  await genres.getByRole("option", { name: "Jazz", exact: true }).click();
  step(
    "choosing a genre narrows the songs",
    await until(async () => (await songTitles(page)).join() === "Oak", 3_000),
    (await songTitles(page)).join(),
  );
  await genres.getByRole("option", { name: "Folk", exact: true }).click();
  await column(page, "Artists").getByRole("option", { name: "Elm", exact: true }).click();
  step(
    "an artist narrows them within the genre",
    await until(async () => (await songTitles(page)).join() === "Ash", 3_000),
    (await songTitles(page)).join(),
  );
  await column(page, "Artists").getByRole("option", { name: /^All/ }).click();
  await column(page, "Albums").getByRole("option", { name: "Woods", exact: true }).click();
  step(
    "an album narrows them too",
    await until(async () => (await songTitles(page)).join() === "Fir", 3_000),
    (await songTitles(page)).join(),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "music-column-browser.png"));

  step(
    "the setting is kept on the server",
    await until(
      async () => (await api(page, "GET", SETTINGS)).json?.values?.["music.columnBrowser"] === true,
      5_000,
    ),
  );
  await reloadDesktop(page);
  await launch(page, "Music");
  await place(page, "Songs").click();
  step(
    "over a reload the browser stays, starting from All",
    await until(
      async () =>
        (await column(page, "Genres").count()) === 1 && (await songTitles(page)).length === 3,
      8_000,
    ),
  );

  // ---- A song shown from elsewhere is not hidden by the browser's choice ---------------------------
  await column(page, "Genres").getByRole("option", { name: "Jazz", exact: true }).click();
  await until(async () => (await songTitles(page)).join() === "Oak", 3_000);
  await page.getByRole("menuitem", { name: "Spotlight" }).click();
  const spotlight = page.getByRole("combobox", { name: "Spotlight Search" });
  await spotlight.fill("Fir");
  await page
    .getByRole("group", { name: /^(?:Music|Top Hit)$/ })
    .getByRole("option", { name: /Fir/ })
    .waitFor({ timeout: 10_000 });
  await spotlight.press("Enter");
  step(
    "a song Spotlight shows is listed and chosen, whatever the browser had chosen",
    await until(
      async () =>
        (await page
          .getByRole("grid", { name: "Songs" })
          .locator('[role="row"][aria-selected="true"]')
          .filter({ hasText: "Fir" })
          .count()) === 1,
      8_000,
    ),
  );

  // ---- ⌥⌘F ----------------------------------------------------------------------------------------
  await songRows(page).first().click();
  await page.keyboard.press("Alt+ControlOrMeta+f");
  step(
    "⌥⌘F puts the keyboard in the search field",
    await until(
      async () => page.evaluate(() => document.activeElement?.tagName === "INPUT"),
      3_000,
    ),
  );
});

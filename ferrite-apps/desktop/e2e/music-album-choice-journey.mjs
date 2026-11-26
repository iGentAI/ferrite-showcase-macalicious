#!/usr/bin/env node
// Music's Up Next reordered by a drag, kept on the server, and several albums chosen with Command and
// Shift: the menu on one acts on them all, and a dragged album lands in a playlist.
//
//   node e2e/music-album-choice-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { writeFileSync } from "node:fs";
import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("music-album-choice", { ignoreOtherOrigins: true });
const LIBRARY = "/api/music/library";
const PLAYBACK = "/api/music/playback";
const TITLES = ["Fir", "Ash", "Oak", "Elm"];

function wav(title) {
  const rate = 8_000;
  const pcm = Buffer.alloc(rate * 20);
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
    chunk("IPRD", text(`${title} Album`)),
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
const library = async (page) => (await api(page, "GET", LIBRARY)).json?.library;
const playback = async (page) => (await api(page, "GET", PLAYBACK)).json?.playback;

async function dragFromTo(page, from, to) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + 2, { steps: 10 });
}

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
  const files = TITLES.map((title, index) => {
    const file = path.join(out, `music-choice-${index}.wav`);
    writeFileSync(file, wav(title));
    return file;
  });
  await window.locator('input[type="file"][aria-label="Add to Library"]').setInputFiles(files);
  step(
    "four songs are imported",
    await until(async () => (await library(page))?.songs?.length === 4, 40_000),
  );
  const added = await library(page);
  const idOf = (title) => added.songs.find((song) => song.title === title).id;

  // ---- Several albums ----------------------------------------------------------------------------
  await place(page, "Albums").click();
  const card = (title) =>
    window
      .locator("[data-album]")
      .filter({ hasText: `${title} Album` })
      .first();
  await card("Ash").waitFor({ timeout: 10_000 });
  const chosenCount = () => window.locator("[data-album][data-chosen]").count();
  await card("Ash").click();
  await card("Elm").click({ modifiers: ["ControlOrMeta"] });
  step("Command-click chooses a second album", (await chosenCount()) === 2);
  await page.waitForTimeout(250);
  await shot(page, path.join(out, "music-albums-chosen.png"));

  await card("Elm").click({ button: "right" });
  const menu = page.getByRole("menu").filter({ hasText: "Play Later" });
  await menu.getByRole("menuitem", { name: "Love", exact: true }).click();
  step(
    "the menu on a chosen album acts on them all",
    await until(async () => {
      const loved = (await library(page))?.loved ?? [];
      return loved.includes(idOf("Ash")) && loved.includes(idOf("Elm")) && loved.length === 2;
    }, 5_000),
  );

  await chooseMenu(page, "File", "New", "Playlist");
  step(
    "a playlist is made",
    await until(async () => (await library(page))?.playlists?.length === 1, 5_000),
  );
  await place(page, "Albums").click();
  await card("Ash").waitFor({ timeout: 5_000 });
  await card("Fir").click();
  await card("Oak").click({ modifiers: ["ControlOrMeta"] });
  const target = window
    .getByRole("treeitem", { name: (await library(page)).playlists[0].name, exact: true })
    .first();
  await dragFromTo(page, card("Oak"), target);
  await page.mouse.up();
  step(
    "dragging a chosen album to a playlist brings them all",
    await until(async () => {
      const songs = (await library(page))?.playlists?.[0]?.songs ?? [];
      return songs.includes(idOf("Fir")) && songs.includes(idOf("Oak")) && songs.length === 2;
    }, 5_000),
    JSON.stringify((await library(page))?.playlists?.[0]?.songs),
  );

  // ---- One album left chosen: the Song menu acts on it, not on the song loaded --------------------
  await place(page, "Songs").click();
  await place(page, "Albums").click();
  await card("Oak").waitFor({ timeout: 5_000 });
  await card("Oak").click({ modifiers: ["ControlOrMeta"] });
  await chooseMenu(page, "Song", "Love");
  step(
    "a Command-click on one album makes it the Song menu's",
    await until(async () => ((await library(page))?.loved ?? []).includes(idOf("Oak")), 5_000),
  );
  await card("Fir").click({ modifiers: ["ControlOrMeta"] });
  await card("Fir").click({ modifiers: ["ControlOrMeta"] });
  await chooseMenu(page, "Song", "Unlove");
  step(
    "a choice reduced to one album acts on that one alone",
    await until(async () => {
      const loved = (await library(page))?.loved ?? [];
      return !loved.includes(idOf("Oak")) && !loved.includes(idOf("Fir"));
    }, 5_000),
  );

  // ---- Up Next -----------------------------------------------------------------------------------
  await place(page, "Songs").click();
  const grid = window.getByRole("grid", { name: "Songs" });
  await grid.getByRole("row", { name: /Ash/ }).first().dblclick();
  await until(async () => ((await playback(page))?.queue?.length ?? 0) === 4, 8_000);
  await window.getByRole("button", { name: "Up Next", exact: true }).click();
  const panel = window.locator('[data-music-panel="up-next"]');
  const upcoming = panel.getByRole("option");
  await upcoming.first().waitFor({ timeout: 5_000 });
  const titles = async () => (await upcoming.allInnerTexts()).map((text) => text.split("\n")[0]);
  const before = await titles();
  step("Up Next lists the three songs after the one playing", before.length === 3, before.join());

  await dragFromTo(page, upcoming.nth(2), upcoming.nth(0));
  await page.waitForTimeout(150);
  const line = await panel.locator(".mac-music-drop-line").count();
  step("a drag shows where the song will land", line === 1);
  await shot(page, path.join(out, "music-up-next-reorder.png"));
  await page.mouse.up();
  const expected = [before[2], before[0], before[1]];
  step(
    "the last song is now first in Up Next",
    await until(async () => (await titles()).join() === expected.join(), 3_000),
    (await titles()).join(),
  );
  const queueTitles = async () => {
    const state = await playback(page);
    return (state?.queue ?? []).map(
      (id) => added.songs.find((song) => song.id === id)?.title ?? id,
    );
  };
  step(
    "the new order is kept on the server",
    await until(async () => (await queueTitles()).slice(1).join() === expected.join(), 8_000),
    (await queueTitles()).join(),
  );

  await reloadDesktop(page);
  await launch(page, "Music");
  step(
    "over a reload the order stays",
    await until(async () => (await queueTitles()).slice(1).join() === expected.join(), 8_000),
  );
});

#!/usr/bin/env node
// TV: File > New Playlist and its key, the card menu's Add to Playlist, dragging into and within a
// playlist, rename, remove and delete, each read back from the server and over a reload.
//
//   node e2e/tv-playlists-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("tv-playlists", { ignoreOtherOrigins: true });
const LIBRARY = "/api/tv/library";

async function openTv(page) {
  await launch(page, "TV");
  const window = page.getByRole("region", { name: "TV", exact: true }).first();
  await window.waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (frame) => !frame.hasAttribute("aria-busy"),
    await window.elementHandle(),
    { timeout: 15_000 },
  );
  return window;
}

await run(async (page) => {
  await openDesktop(page, base, step);
  let window = await openTv(page);
  const stored = async () => (await api(page, "GET", LIBRARY)).json?.library?.playlists ?? [];
  const name = (sheet, text) => sheet.getByRole("textbox", { name: "Playlist name" }).fill(text);

  // ---- New, from the menu -----------------------------------------------------------------------
  await chooseMenu(page, "File", "New Playlist…");
  let sheet = page.getByRole("dialog", { name: "New Playlist" });
  await sheet.waitFor({ timeout: 5_000 });
  await name(sheet, "Evening");
  await sheet.getByRole("button", { name: "Create" }).click();
  const evening = window.getByRole("region", { name: "Evening" });
  await evening.waitFor({ timeout: 5_000 });
  step(
    "File > New Playlist makes it and shows the Library",
    await until(async () => (await stored())[0]?.name === "Evening", 5_000),
    JSON.stringify(await stored()),
  );

  // ---- Add from a card's menu -------------------------------------------------------------------
  await chooseMenu(page, "View", "Movies");
  const movies = window.getByRole("region", { name: "Open Movies" });
  await movies.waitFor({ timeout: 5_000 });
  const card = (at) => movies.locator(".mac-card-grid-card").nth(at);
  const titles = await movies.locator(".mac-card-grid-card-title").allInnerTexts();
  const addToEvening = async (at) => {
    await card(at).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add to Playlist" }).hover();
    await page.getByRole("menuitem", { name: "Evening" }).click();
  };
  await addToEvening(0);
  await addToEvening(1);
  await addToEvening(2);
  step(
    "Add to Playlist in a card's menu puts three videos in it",
    await until(async () => (await stored())[0]?.videos.length === 3, 5_000),
    JSON.stringify((await stored())[0]?.videos),
  );
  await card(0).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Playlist" }).hover();
  const held = page.getByRole("menuitem", { name: "Evening" });
  await held.waitFor({ timeout: 3_000 });
  step(
    "a video already in the playlist is dimmed there, saying so",
    (await held.getAttribute("aria-disabled")) === "true" &&
      /is in the playlist/.test((await held.getAttribute("title")) ?? ""),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // ---- New from a card, with its key ------------------------------------------------------------
  await card(0).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add to Playlist" }).hover();
  await page.getByRole("menuitem", { name: "New Playlist…" }).click();
  sheet = page.getByRole("dialog", { name: "New Playlist" });
  await name(sheet, "Shorts");
  await page.keyboard.press("Enter");
  const shorts = window.getByRole("region", { name: "Shorts" });
  await shorts.waitFor({ timeout: 5_000 });
  step(
    "New Playlist in a card's menu holds that card's video",
    await until(async () => (await stored())[1]?.videos.length === 1, 5_000),
    JSON.stringify((await stored())[1]),
  );
  await window.click({ position: { x: 250, y: 18 } });
  await page.keyboard.press("ControlOrMeta+n");
  sheet = page.getByRole("dialog", { name: "New Playlist" });
  await sheet.waitFor({ timeout: 5_000 });
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 3_000 });
  step("its key opens the sheet, and Cancel makes nothing", (await stored()).length === 2);

  // ---- Drag within and between ------------------------------------------------------------------
  const inEvening = (at) => evening.locator(".mac-card-grid-card").nth(at);
  const before = (await stored())[0].videos;
  await inEvening(2).dragTo(inEvening(0));
  step(
    "a card dragged within a playlist moves there on the server",
    await until(
      async () => (await stored())[0]?.videos.join() === [before[2], before[0], before[1]].join(),
      5_000,
    ),
    JSON.stringify((await stored())[0]?.videos),
  );
  await inEvening(0).dragTo(shorts.getByRole("heading", { name: "Shorts" }));
  step(
    "a card dragged to another playlist joins it, and stays where it was",
    await until(async () => {
      const [first, second] = await stored();
      return second?.videos.includes(before[2]) && first?.videos.includes(before[2]);
    }, 5_000),
    JSON.stringify((await stored())[1]?.videos),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "tv-playlists.png"));

  // ---- Over a reload ----------------------------------------------------------------------------
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  window = await openTv(page);
  const again = window.getByRole("region", { name: "Evening" });
  await again.waitFor({ timeout: 10_000 });
  step(
    "the playlists and their order are there after a reload",
    (await again.locator(".mac-card-grid-card-title").allInnerTexts()).join() ===
      [titles[2], titles[0], titles[1]].join(),
    (await again.locator(".mac-card-grid-card-title").allInnerTexts()).join(" / "),
  );

  // ---- Remove, rename, delete -------------------------------------------------------------------
  await again.locator(".mac-card-grid-card").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove from Playlist" }).click();
  step(
    "Remove from Playlist takes it out of that playlist",
    await until(async () => (await stored())[0]?.videos.length === 2, 5_000),
  );
  const heading = window.getByRole("heading", { name: "Evening" });
  await heading.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename Playlist…" }).click();
  sheet = page.getByRole("dialog", { name: "Rename Playlist" });
  await name(sheet, "Late");
  await sheet.getByRole("button", { name: "Rename" }).click();
  step(
    "Rename Playlist changes its name on the server",
    await until(async () => (await stored())[0]?.name === "Late", 5_000),
  );
  await window.getByRole("heading", { name: "Late" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete Playlist" }).click();
  step(
    "Delete Playlist removes it, leaving the other",
    await until(async () => {
      const left = await stored();
      return left.length === 1 && left[0]?.name === "Shorts";
    }, 5_000),
  );

  // ---- A library saved near the server's limit --------------------------------------------------
  const { json } = await api(page, "GET", LIBRARY);
  const seeded = {
    videos: Array.from({ length: 900 }, (_, at) => ({
      id: `n${String(at).padStart(10, "0")}`,
      title: "t".repeat(at < 9 ? 265 : 165),
      channel: "",
    })),
    history: [],
    upNext: [],
    watchLater: [],
    positions: {},
  };
  const size = JSON.stringify(seeded).length;
  step(
    "the seeded library is within 100 bytes of the limit",
    size > 189_900 && size <= 190_000,
    `${size}`,
  );
  const seeding = await api(page, "PUT", LIBRARY, { library: seeded, rev: json.rev });
  step("the server takes it", seeding.status === 200, `${seeding.status}`);
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  window = await openTv(page);
  await chooseMenu(page, "File", "New Playlist…");
  sheet = page.getByRole("dialog", { name: "New Playlist" });
  const longName = "Kept near the limit ".repeat(5).trim();
  await name(sheet, "Short");
  await sheet.getByRole("button", { name: "Create" }).click();
  await window.getByRole("region", { name: "Short", exact: true }).waitFor({ timeout: 10_000 });
  step(
    "a playlist made there is accepted by the server, one unused video making room",
    await until(async () => {
      const library = (await api(page, "GET", LIBRARY)).json?.library;
      return library?.playlists?.[0]?.name === "Short" && library.videos.length === 899;
    }, 8_000),
    `${(await api(page, "GET", LIBRARY)).json?.library?.videos?.length} videos`,
  );
  await window.getByRole("heading", { name: "Short", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename Playlist…" }).click();
  sheet = page.getByRole("dialog", { name: "Rename Playlist" });
  await name(sheet, longName);
  await sheet.getByRole("button", { name: "Rename" }).click();
  step(
    "a longer name there is accepted too",
    await until(async () => (await stored())[0]?.name === longName, 8_000),
  );
  await page.waitForTimeout(500);
  await reloadDesktop(page);
  window = await openTv(page);
  await window.getByRole("region", { name: longName }).waitFor({ timeout: 10_000 });
  step("and it survives a reload", true);
});

process.exit(0);

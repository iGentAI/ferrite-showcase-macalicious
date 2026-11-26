#!/usr/bin/env node
// Chess > Preferences: the board's and the pieces' colours, the computer's usual strength and which way
// the board faces, each seen on the board or in New Game, kept on the server and over a reload.
//
//   node e2e/chess-preferences-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("chess-preferences", { ignoreOtherOrigins: true });
const SETTINGS = "/api/system-preferences/settings";
const GREEN_DARK = "rgb(111, 148, 96)";
const WARM_WHITE = "#f7ecd5";

const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const darkSquare = (page) =>
  square(page, "a1").evaluate((element) => getComputedStyle(element).backgroundColor);
const pieceColor = (page) =>
  page
    .locator(".mac-chess")
    .first()
    .evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--mac-chess-piece-white").trim(),
    );
const values = async (page) => (await api(page, "GET", SETTINGS)).json?.values ?? {};

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  const before = await darkSquare(page);

  const row = await menuItemState(page, "Chess", "Preferences…");
  step("Chess > Preferences… is no longer dimmed", row.disabled !== true, JSON.stringify(row));
  await chooseMenu(page, "Chess", "Preferences…");
  const window = page.getByRole("region", { name: "Chess Preferences" }).first();
  await window.waitFor({ timeout: 8_000 });

  const choose = async (label, name) => {
    await window.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name, exact: true }).click();
  };
  await choose("Board", "Green");
  step(
    "Board > Green colours the board's squares",
    await until(async () => (await darkSquare(page)) === GREEN_DARK, 3_000),
    `${before} > ${await darkSquare(page)}`,
  );
  await choose("Pieces", "Ivory and Umber");
  step(
    "Pieces > Ivory and Umber colours the pieces",
    await until(async () => (await pieceColor(page)) === WARM_WHITE, 3_000),
    await pieceColor(page),
  );
  await choose("Computer plays at", "Level 3 (club)");
  await window.getByRole("checkbox", { name: "Show my side at the bottom" }).click();
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "chess-preferences.png"));
  step(
    "Speak moves can be turned on",
    await window.getByRole("checkbox", { name: "Speak moves" }).isEnabled(),
  );
  step(
    "each choice is kept on the server",
    await until(async () => {
      const kept = await values(page);
      return (
        kept["chess.boardStyle"] === "green" &&
        kept["chess.pieceStyle"] === "warm" &&
        kept["chess.level"] === 3 &&
        kept["chess.sideDown"] === true
      );
    }, 5_000),
    JSON.stringify(await values(page)),
  );

  // ---- Over a reload, and in play -----------------------------------------------------------------
  await reloadDesktop(page);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  step(
    "over a reload the board keeps its colours",
    await until(async () => (await darkSquare(page)) === GREEN_DARK, 8_000),
    await darkSquare(page),
  );
  const cells = () =>
    board(page)
      .locator('[role="gridcell"]')
      .evaluateAll((all) => all[0]?.getAttribute("data-square"));
  const whiteUp = await cells();
  await page.keyboard.press("ControlOrMeta+n");
  const sheet = page.getByRole("dialog", { name: "New Game" });
  await sheet.waitFor({ timeout: 5_000 });
  const strength = await sheet.getByRole("combobox", { name: "Strength" }).innerText();
  step("New Game starts at the strength chosen", /Level 3/.test(strength), strength);

  await sheet.getByRole("combobox", { name: "Play as" }).click();
  await page.getByRole("option", { name: "Black", exact: true }).click();
  await sheet.getByRole("button", { name: "Start Game" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 8_000 });
  step(
    "a game as Black has Black at the bottom",
    whiteUp === "a8" && (await until(async () => (await cells()) === "h1", 5_000)),
    `${whiteUp} > ${await cells()}`,
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "chess-board-green.png"));

  // ---- An open board, named in the page's address ---------------------------------------------
  await page.goto(`${base}/?game=prefs-${Date.now().toString(36)}`, { waitUntil: "load" });
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  step(
    "an open board wears the kept colours",
    await until(async () => (await darkSquare(page)) === GREEN_DARK, 8_000),
    await darkSquare(page),
  );
  await chooseMenu(page, "Chess", "Preferences…");
  await window.waitFor({ timeout: 8_000 });
  step(
    "on an open board, the computer's strength is dimmed",
    await window.getByRole("combobox", { name: "Computer plays at" }).isDisabled(),
  );
  await choose("Board", "Blue");
  step(
    "Preferences change an open board too",
    await until(async () => (await darkSquare(page)) !== GREEN_DARK, 3_000),
    await darkSquare(page),
  );
});

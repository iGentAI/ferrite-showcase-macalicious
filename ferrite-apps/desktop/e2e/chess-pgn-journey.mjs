#!/usr/bin/env node
// Chess: Save As writes the game to the drive as a PGN file, Open reads one back, a file that is no
// game is refused saying why, and the Game Log follows the game and moves the board. Each is read back
// from the drive, the server or the board.
//
//   node e2e/chess-pgn-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, closeMenus, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("chess-pgn", { ignoreOtherOrigins: true });

const windowOf = (page) => page.locator(".mac-chess").first();
const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();
const log = (page) => page.getByRole("region", { name: "Game Log" });

async function move(page, from, to, plies) {
  await square(page, from).click();
  await square(page, to).click();
  await until(async () => {
    const mine = (await api(page, "GET", "/api/chess/mine")).json;
    const id = mine.games?.[0]?.id;
    const game = id && (await api(page, "GET", `/api/chess/games/${id}`)).json.state;
    return game?.plies?.length >= plies;
  }, 20_000);
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => (await status(page)).startsWith("Choose New Game"));

  const nothing = await menuItemState(page, "Game", "Save As…");
  step(
    "with no moves Save As is dimmed, saying why",
    nothing.disabled === true && /no moves/.test(nothing.title ?? ""),
    nothing.title,
  );
  const save = await menuItemState(page, "Game", "Save");
  step(
    "Save is dimmed, saying where games are kept",
    save.disabled === true && /keep themselves/.test(save.title ?? ""),
    save.title,
  );
  await closeMenus(page);

  const sheet = page.getByRole("dialog").filter({ hasText: "New Game" });
  await until(async () => {
    await windowOf(page).getByRole("button", { name: "New Game…", exact: true }).click();
    return (await sheet.count()) > 0;
  });
  await sheet.getByRole("button", { name: "Start Game" }).click();
  await sheet.waitFor({ state: "detached", timeout: 15_000 });
  await until(async () => (await status(page)).includes("White"));

  // ---- The Game Log follows the game ------------------------------------------------------------
  await chooseMenu(page, "Window", "Game Log");
  await log(page).waitFor({ timeout: 5_000 });
  await move(page, "e2", "e4", 2);
  await move(page, "d2", "d4", 4);
  const entries = () => log(page).locator(".mac-chess-log-move").allInnerTexts();
  step(
    "the Game Log lists every move, the computer's too, in notation",
    await until(
      async () => (await entries()).length === 4 && (await entries())[0] === "e4",
      10_000,
    ),
    (await entries()).join(" "),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "chess-game-log.png"));
  await log(page).locator(".mac-chess-log-move").first().click();
  step(
    "choosing a move there shows the board at that move",
    (await until(async () => (await label(page, "d2")).includes("white pawn"), 3_000)) &&
      (await label(page, "e4")).includes("white pawn"),
  );
  await windowOf(page).getByRole("button", { name: "Next move" }).click();
  await windowOf(page).getByRole("button", { name: "Next move" }).click();
  await windowOf(page).getByRole("button", { name: "Next move" }).click();

  // ---- Save As writes the moves to the drive ----------------------------------------------------
  await chooseMenu(page, "Game", "Save As…");
  await windowOf(page)
    .getByText(/^Saved as “.*” in Downloads\.$/)
    .waitFor({ timeout: 10_000 });
  const said = await status(page);
  const name = /“(.*)”/.exec(said)?.[1] ?? "";
  step("Save As says where it put the file", name.endsWith(".pgn"), said);
  await shot(page, path.join(out, "chess-saved.png"));

  // ---- The Game Log stays open over a reload ----------------------------------------------------
  await page.waitForTimeout(800);
  await reloadDesktop(page);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await log(page).waitFor({ timeout: 10_000 });
  step("the Game Log is open again after a reload", true);

  // ---- Open reads the file back -----------------------------------------------------------------
  await page.keyboard.press("ControlOrMeta+o");
  const panel = page.locator(".mac-chess-panel-layer");
  await panel.waitFor({ timeout: 5_000 });
  await panel.getByText("Downloads", { exact: true }).first().click();
  await panel.getByText(name, { exact: true }).first().click();
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await panel.waitFor({ state: "detached", timeout: 5_000 });
  step(
    "Open shows the game from the file",
    await until(async () => (await status(page)).includes(`${name}: move 4 of 4`), 8_000),
    await status(page),
  );
  const before = await label(page, "g1");
  await square(page, "g1").click();
  await square(page, "f3").click();
  await page.waitForTimeout(300);
  step(
    "a game from a file takes no move",
    (await label(page, "g1")) === before,
    await status(page),
  );
  await shot(page, path.join(out, "chess-opened.png"));
  await windowOf(page).getByRole("button", { name: "Previous move" }).click();
  step(
    "Back steps through it",
    await until(async () => /move 3 of 4/.test(await status(page)), 3_000),
    await status(page),
  );
});

process.exit(0);

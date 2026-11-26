#!/usr/bin/env node
// Chess's Take Back Move: the menu row, the board's menu and ⌘Z, each read back from the server.
//
//   node e2e/chess-take-back-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("chess-take-back", { ignoreOtherOrigins: true });

const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);

async function plies(page) {
  const mine = (await api(page, "GET", "/api/chess/mine")).json;
  const id = mine.games?.[0]?.id;
  return id ? (await api(page, "GET", `/api/chess/games/${id}`)).json.state?.plies?.length : null;
}

async function startGame(page, side) {
  await page.keyboard.press("ControlOrMeta+n");
  const sheet = page.getByRole("dialog", { name: "New Game" });
  await sheet.waitFor({ timeout: 8_000 });
  await sheet.getByRole("combobox", { name: "Strength" }).click();
  await page.getByRole("option", { name: "Level 1 (beginner)", exact: true }).click();
  if (side === "Black") {
    await sheet.getByRole("combobox", { name: "Play as" }).click();
    await page.getByRole("option", { name: side, exact: true }).click();
  }
  await sheet.getByRole("button", { name: "Start Game" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 8_000 });
}

const move = async (page, from, to) => {
  await square(page, from).click();
  await square(page, to).click();
};

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".mac-chess-status").getByText("Choose New Game").waitFor({ timeout: 15_000 });

  await startGame(page, "White");
  const dimmed = await menuItemState(page, "Moves", "Take Back Move");
  step(
    "before a move there is nothing to take back",
    dimmed.disabled === true,
    JSON.stringify(dimmed),
  );

  await move(page, "e2", "e4");
  step(
    "the computer answers",
    await until(async () => (await plies(page)) === 2, 20_000),
    String(await plies(page)),
  );
  await until(
    async () => (await menuItemState(page, "Moves", "Take Back Move")).disabled !== true,
    5_000,
  );
  await chooseMenu(page, "Moves", "Take Back Move");
  step(
    "Moves > Take Back Move takes back both moves",
    await until(async () => (await plies(page)) === 0, 8_000),
    String(await plies(page)),
  );
  step(
    "the pawn is home again",
    await until(
      async () => /pawn/i.test((await square(page, "e2").getAttribute("aria-label")) ?? ""),
      5_000,
    ),
    await square(page, "e2").getAttribute("aria-label"),
  );
  await page.waitForTimeout(500);
  await shot(page, path.join(out, "chess-taken-back.png"));
  step("the computer does not move again on its own", (await plies(page)) === 0);

  await move(page, "d2", "d4");
  step(
    "another move, and the computer's answer",
    await until(async () => (await plies(page)) === 2, 20_000),
    String(await plies(page)),
  );
  await board(page).locator('[role="gridcell"][data-square="h5"]').focus();
  await page.keyboard.press("ControlOrMeta+z");
  step(
    "⌘Z takes back too",
    await until(async () => (await plies(page)) === 0, 8_000),
    String(await plies(page)),
  );

  await move(page, "c2", "c4");
  step(
    "a third move, and the computer's answer",
    await until(async () => (await plies(page)) === 2, 20_000),
    String(await plies(page)),
  );
  await square(page, "h5").click({ button: "right" });
  await page.getByRole("menuitem", { name: /Take Back Move/ }).click();
  step(
    "the board's menu takes back too",
    await until(async () => (await plies(page)) === 0, 8_000),
    String(await plies(page)),
  );

  // ---- Playing Black: the computer's opening stays ----------------------------------------------
  await startGame(page, "Black");
  step(
    "playing Black, the computer opens",
    await until(async () => (await plies(page)) === 1, 20_000),
    String(await plies(page)),
  );
  const opening = await menuItemState(page, "Moves", "Take Back Move");
  step("the computer's opening is not the person's to take back", opening.disabled === true);
  const played = await until(async () => {
    const row = await square(page, "e7");
    return /pawn/i.test((await row.getAttribute("aria-label")) ?? "");
  }, 2_000);
  await move(page, played ? "e7" : "d7", played ? "e6" : "d6");
  step(
    "Black's move, and the computer's answer",
    await until(async () => (await plies(page)) === 3, 20_000),
    String(await plies(page)),
  );
  await until(
    async () => (await menuItemState(page, "Moves", "Take Back Move")).disabled !== true,
    5_000,
  );
  await chooseMenu(page, "Moves", "Take Back Move");
  step(
    "as Black, the board goes back to the computer's opening",
    await until(async () => (await plies(page)) === 1, 8_000),
    String(await plies(page)),
  );

  await reloadDesktop(page);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(1_500);
  step("over a reload it stays taken back", (await plies(page)) === 1, String(await plies(page)));
});

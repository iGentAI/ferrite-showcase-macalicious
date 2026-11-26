#!/usr/bin/env node
// Chess's depth on Ferrite: a piece dragged with the pointer, the Moves menu and its keys, Rotate
// Board and Preferences, each read back from the server or the board, with real input only.
//
//   node e2e/chess-depth-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, menuItemState } from "./media-census-kit.mjs";

const COMMAND = process.platform === "darwin" ? "Meta" : "Control";

const { base, out } = options();
const { step, run } = journey("chess-depth", { ignoreOtherOrigins: true });

const windowOf = (page) => page.locator(".mac-chess").first();
const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();

async function until(check, timeout = 15_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

const centre = async (page, name) => {
  const box = await square(page, name).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Press on `from`, go to `to` in steps, and stay there with the button down. */
async function liftTo(page, from, to) {
  const start = await centre(page, from);
  const end = await centre(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
}

async function drag(page, from, to) {
  await liftTo(page, from, to);
  await page.mouse.up();
}

/** The game on the server the window shows: the person's newest one. */
async function serverGame(page) {
  const mine = (await api(page, "GET", "/api/chess/mine")).json;
  const id = mine.games?.[0]?.id;
  return id ? (await api(page, "GET", `/api/chess/games/${id}`)).json.state : null;
}

async function startGame(page, strength) {
  await until(async () => {
    await windowOf(page).getByRole("button", { name: "New Game…", exact: true }).click();
    return (await page.getByRole("dialog").filter({ hasText: "New Game" }).count()) > 0;
  });
  const sheet = page.getByRole("dialog").filter({ hasText: "New Game" });
  await sheet.waitFor({ timeout: 10_000 });
  await page
    .getByRole("combobox", { name: "Strength" })
    .or(page.getByRole("button", { name: "Strength" }))
    .first()
    .click();
  await page.getByRole("option", { name: strength, exact: true }).click();
  await sheet.getByRole("button", { name: "Start Game" }).click();
  await sheet.waitFor({ state: "detached", timeout: 15_000 });
  await until(async () => (await status(page)).includes("White"));
}

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => (await status(page)).startsWith("Move a white piece"));
  await startGame(page, "Level 1 (beginner)");

  // ---- Drag a piece to move -------------------------------------------------------------------
  await liftTo(page, "e2", "e4");
  await page.waitForTimeout(150);
  step(
    "a dragged piece hangs under the pointer and marks where it can go",
    (await windowOf(page).locator(".mac-chess-lifted").count()) === 1 &&
      (await square(page, "e4").getAttribute("data-target")) === "move",
  );
  await shot(page, path.join(out, "chess-drag.png"));
  await page.mouse.up();
  const moved = await until(async () => (await serverGame(page))?.plies?.[0]?.to === "e4");
  step("dropping it on a legal square plays the move on the server", moved);
  step("the pawn stands on e4", (await label(page, "e4")).includes("white pawn"));
  step(
    "the piece in the air is gone after the drop",
    (await windowOf(page).locator(".mac-chess-lifted").count()) === 0,
  );
  await until(async () => (await serverGame(page))?.plies?.length === 2);

  // A press released outside the board is over: coming back without the button lifts nothing.
  const edge = await square(page, "h2").boundingBox();
  await page.mouse.move(edge.x + edge.width - 1, edge.y + edge.height / 2);
  await page.mouse.down();
  await page.mouse.move(edge.x + edge.width + 40, edge.y + edge.height / 2);
  await page.mouse.up();
  const away = await centre(page, "h3");
  await page.mouse.move(away.x, away.y, { steps: 6 });
  await page.waitForTimeout(150);
  step(
    "a press released outside the board lifts nothing when the pointer returns",
    (await windowOf(page).locator(".mac-chess-lifted").count()) === 0 &&
      (await board(page).locator("[data-selected]").count()) === 0,
  );

  await drag(page, "d2", "d7");
  await page.waitForTimeout(400);
  const after = await serverGame(page);
  step(
    "dropping it on an illegal square leaves the piece and the server's game",
    after.plies.length === 2 && (await label(page, "d2")).includes("white pawn"),
    `${after.plies.length} plies`,
  );
  step(
    "nothing stays picked up after the refused drop",
    (await board(page).locator("[data-selected]").count()) === 0,
  );

  await square(page, "g1").click();
  await square(page, "f3").click();
  const clicked = await until(async () => (await serverGame(page))?.plies?.[2]?.to === "f3");
  step("clicking a piece and then a square still moves", clicked);
  await until(async () => (await serverGame(page))?.plies?.length === 4);

  // ---- Moves menu and its keys ----------------------------------------------------------------
  await square(page, "a2").click();
  await page.keyboard.press("Escape");
  await page.keyboard.press(`${COMMAND}+l`);
  const flashed = await until(async () => (await status(page)).startsWith("Last move"));
  const lastPly = (await serverGame(page)).plies[3];
  step(
    "Command-L points at the last move on the board",
    flashed &&
      (await square(page, lastPly.from).getAttribute("data-pointed")) === "" &&
      (await square(page, lastPly.to).getAttribute("data-pointed")) === "",
    await status(page),
  );
  await page.waitForTimeout(100);
  await shot(page, path.join(out, "chess-last-move.png"));

  await chooseMenu(page, "Moves", "Show Hint");
  const hinted = await until(async () => (await status(page)).startsWith("Hint:"));
  step(
    "Show Hint explains the idea before marking a square",
    hinted &&
      (await status(page)).includes("Show Suggested Move") &&
      (await board(page).locator("[data-pointed]").count()) === 0,
    await status(page),
  );
  await chooseMenu(page, "Moves", "Show Suggested Move");
  await until(async () => /Hint: (\w\d) to (\w\d)/.test(await status(page)));
  const hint = /Hint: (\w\d) to (\w\d)/.exec(await status(page));
  step("Show Suggested Move names a move and marks it", hinted && !!hint, await status(page));
  step(
    "the hint's squares are marked and the hint is legal",
    !!hint &&
      (await square(page, hint[1]).getAttribute("data-pointed")) === "" &&
      (await label(page, hint[1])).includes("white"),
  );
  await shot(page, path.join(out, "chess-hint.png"));

  const force = await menuItemState(page, "Moves", "Force Computer Move");
  step("Force Computer Move is dimmed on the person's turn", force?.disabled === true);
  if (!hint) throw new Error("Show Suggested Move did not reveal a move");
  const pliesBefore = (await serverGame(page)).plies.length;
  await square(page, hint[1]).click();
  await square(page, hint[2]).click();
  const answered = await until(
    async () => (await serverGame(page)).plies.length === pliesBefore + 2,
  );
  const played = (await serverGame(page)).plies[pliesBefore];
  step(
    "the suggested move is recorded and the computer answers",
    answered && played?.from === hint[1] && played?.to === hint[2],
  );

  await square(page, "a1").click();
  await page.keyboard.press(`${COMMAND}+z`);
  step(
    "Command-Z takes back the last move and the computer's answer",
    await until(async () => (await serverGame(page)).plies.length === pliesBefore, 8_000),
  );

  await square(page, "e4").click({ button: "right" });
  const hintRow = page.getByRole("menuitem", { name: "Show Hint", exact: true });
  await hintRow.waitFor({ timeout: 5_000 });
  await page.waitForTimeout(450);
  await shot(page, path.join(out, "chess-board-menu.png"));
  const takeBackRow = page.getByRole("menuitem", { name: "Take Back Move" });
  step(
    "the board's menu offers Take Back in a game with moves",
    (await takeBackRow.getAttribute("aria-disabled")) !== "true",
  );
  await hintRow.click();
  step(
    "Show Hint from the board's menu gives a hint",
    await until(async () => (await status(page)).startsWith("Hint:")),
    await status(page),
  );

  await square(page, "a1").click();
  await page.keyboard.press(`${COMMAND}+n`);
  const sheet = page.getByRole("dialog").filter({ hasText: "New Game" });
  await sheet.waitFor({ timeout: 5_000 });
  step("Command-N opens New Game", await sheet.isVisible());
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await sheet.waitFor({ state: "detached", timeout: 5_000 });

  // ---- Rotate Board ---------------------------------------------------------------------------
  const stands = async () => {
    const a1 = await centre(page, "a1");
    const h8 = await centre(page, "h8");
    return { turned: a1.x > h8.x && a1.y < h8.y, upright: a1.x < h8.x && a1.y > h8.y };
  };
  step("the board starts with White at the bottom", (await stands()).upright);
  await chooseMenu(page, "View", "Rotate Board");
  await until(async () => (await stands()).turned, 3_000);
  step("View > Rotate Board turns it around", (await stands()).turned);
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "chess-rotated.png"));

  await square(page, "a1").focus();
  await page.keyboard.press("ArrowLeft");
  step(
    "the arrows go as the squares stand: left of a1 is now b1",
    (await page.evaluate(() => document.activeElement?.dataset.square)) === "b1",
  );

  // A drag on the turned board still moves by the squares' names.
  const before = (await serverGame(page)).plies.length;
  const pieces = await windowOf(page)
    .locator("[data-square]")
    .evaluateAll((all) => all.map((one) => [one.dataset.square, one.getAttribute("aria-label")]));
  const pawn = pieces.find(
    ([name, label]) =>
      name.endsWith("2") &&
      /white pawn/i.test(label ?? "") &&
      !/pawn|knight|bishop|rook|queen|king/i.test(
        pieces.find(([other]) => other === `${name[0]}3`)?.[1] ?? "",
      ),
  );
  const [from] = pawn ?? [""];
  step("a White pawn can step forward", Boolean(from), from);
  await drag(page, from, `${from[0]}3`);
  await until(async () => (await serverGame(page)).plies.length > before, 8_000);
  step(
    "a piece dragged on the turned board moves, kept on the server",
    (await serverGame(page)).plies.length > before,
    from,
  );

  await reloadDesktop(page);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await until(async () => (await stands()).turned, 8_000);
  step("it stays turned after a reload", (await stands()).turned);
  await square(page, "a1").click();
  await page.keyboard.press(`${COMMAND}+r`);
  await until(async () => (await stands()).upright, 3_000);
  step("Command-R turns it back", (await stands()).upright);
});
process.exit(0);

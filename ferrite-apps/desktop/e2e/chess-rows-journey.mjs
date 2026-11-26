#!/usr/bin/env node
// Chess's clocks and notifications, two people. Chris plays the computer on a one-minute clock and
// lets it run out; then he invites Martin to a clocked game, whose clock starts when Martin
// accepts, and Martin hears of each move in a notification. Then the rows of the Chess inventory
// that had no picture of their own: Game and Moves menu rows, promotion, a claimed draw, the
// keys on the board, and the game kept across a reload.
//
//   node e2e/chess-rows-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { api } from "./app-journey.mjs";
import { chooseMenu, closeMenus, until } from "./media-census-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("chess-rows");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `crchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `crmartin-${id}`, fullName: `Martin ${id}`, password };
const LIVE_MS = 20_000;

const windowOf = (page) => page.locator(".mac-chess").first();
const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();
const title = async (page) =>
  (await windowOf(page).locator(".mac-chess-title").innerText()).replace(/\s+/g, " ").trim();
const clock = (page, name) => page.getByRole("status", { name: `${name}'s clock` });
const button = (page, name) => windowOf(page).getByRole("button", { name, exact: true });

async function move(page, from, to) {
  await square(page, from).click();
  await square(page, to).click();
}

async function choose(page, name, option) {
  await page.getByRole("combobox", { name }).or(page.getByRole("button", { name })).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The newest game on the person's list. */
async function newest(page) {
  const mine = (await api(page, "GET", "/api/chess/mine")).json;
  const gameId = mine.games?.[0]?.id;
  return gameId
    ? { id: gameId, ...(await api(page, "GET", `/api/chess/games/${gameId}`)).json }
    : null;
}

/** A ply sent the way a page sends it, to set a position up. */
const ply = (page, game, index, from, to) =>
  api(page, "POST", `/api/chess/games/${game}/plies`, { number: 1, ply: index, from, to });

/** An invitation sent through New Game, and accepted through Martin's Games sheet. */
async function invited(a, b, minutes, variant = "Regular") {
  await chooseMenu(a, "Game", "New Game…");
  const sheet = a.getByRole("dialog").filter({ hasText: "New Game" });
  await sheet.waitFor({ timeout: 10_000 });
  await choose(a, "Opponent", "Another person");
  await sheet.getByRole("textbox", { name: "Account name" }).fill(martin.name);
  await choose(a, "Play as", "White");
  await choose(a, "Variant", variant);
  await choose(a, "Clock", minutes ? `${minutes} minutes each` : "No clock");
  await sheet.getByRole("button", { name: "Send Invitation" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 8_000 });
  const gamesButton = windowOf(b).getByRole("button", { name: /^Games/ });
  await within(LIVE_MS, async () => /\(1\)/.test(await gamesButton.innerText()));
  await gamesButton.click();
  const list = b.getByRole("dialog").filter({ hasText: "Games" });
  await list.waitFor({ timeout: 10_000 });
  await list.getByRole("button", { name: "Accept" }).first().click();
  await list.waitFor({ state: "hidden", timeout: 30_000 });
  await within(LIVE_MS, async () => !(await status(a)).includes("Waiting for"));
  return (await newest(a)).id;
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  for (const page of [a, b]) {
    await openFromDock(page, "Chess", "Chess").catch(() => {});
    await board(page).waitFor({ state: "visible", timeout: 15_000 });
  }

  // ---- The computer, on a one-minute clock ----------------------------------------------------
  await chooseMenu(a, "Game", "New Game…");
  const sheet = a.getByRole("dialog").filter({ hasText: "New Game" });
  await sheet.waitFor({ timeout: 10_000 });
  await choose(a, "Clock", "1 minute each");
  await a.waitForTimeout(300);
  await shot(a, "chess-rows-new-game");
  step("Game > New Game… opens the sheet, with a clock to choose", true);
  await sheet.getByRole("button", { name: "Start Game" }).click();
  await sheet.waitFor({ state: "hidden", timeout: 8_000 });
  const mineFace = clock(a, chris.fullName);
  await mineFace.waitFor({ timeout: 8_000 });
  step(
    "the clock runs for the side to move",
    await until(async () => (await mineFace.innerText()) !== "1:00", 5_000),
    await mineFace.innerText(),
  );
  await shot(a, "chess-rows-clock");
  await move(a, "e2", "e4");
  await within(20_000, async () => (await newest(a))?.state?.plies?.length === 2);
  const first = await within(70_000, async () => /ran out of time/.test(await status(a)));
  step("at 0:00 the game ends on time", first !== null, await status(a));
  await shot(a, "chess-rows-out-of-time");
  const ended = (await newest(a)).state.ended;
  step(
    "the server holds the ending",
    ended?.reason === "time" && ended?.winner === "black",
    JSON.stringify(ended),
  );

  // ---- Martin, invited, clocked: the invitation, the move, and the notifications ----------------
  await invited(a, b, 5);
  step(
    "Martin's clock has not moved until he must",
    (await clock(b, martin.fullName).innerText()) === "5:00",
  );
  await shot(b, "chess-rows-invited-accepted");
  await move(a, "e2", "e4");
  await within(LIVE_MS, async () => (await label(b, "e4")).includes("white pawn"));
  step(
    "the banner shows it",
    await b
      .getByText(/played e2 to e4/)
      .first()
      .waitFor({ timeout: LIVE_MS })
      .then(
        () => true,
        () => false,
      ),
  );
  await shot(b, "chess-rows-notification");
  step(
    "Martin's notifications keep Chris's move",
    JSON.stringify((await api(b, "GET", "/api/notification-center/inbox")).json).includes(
      "played e2 to e4",
    ),
  );

  // Rows of the two menus, on the game in hand.
  await move(b, "e7", "e5");
  await within(LIVE_MS, async () => (await label(a, "e5")).includes("black pawn"));
  await chooseMenu(a, "Moves", "Previous Move");
  step(
    "Moves > Previous Move steps back",
    await until(async () => !(await label(a, "e5")).includes("black pawn"), 15_000),
  );
  await chooseMenu(a, "Moves", "Next Move");
  step(
    "Moves > Next Move steps on",
    await until(async () => (await label(a, "e5")).includes("black pawn"), 15_000),
  );
  await shot(a, "chess-rows-moves");

  // The board's keys: arrows, Home, End, Space to pick up and to put down, Escape.
  await square(a, "e4").focus();
  await a.keyboard.press("ArrowLeft");
  await a.keyboard.press("Home");
  const focused = () => a.evaluate(() => document.activeElement?.getAttribute("data-square"));
  step("Home goes to the rank's first square", (await focused())?.startsWith("a"), await focused());
  await a.keyboard.press("End");
  step("End goes to its last", (await focused())?.startsWith("h"), await focused());
  await square(a, "g1").focus();
  await a.keyboard.press("Space");
  await a.keyboard.press("Escape");
  await square(a, "g1").focus();
  await a.keyboard.press("Enter");
  await square(a, "f3").focus();
  await a.keyboard.press("Enter");
  step(
    "Return picks a piece up and puts it down",
    await until(async () => (await label(a, "f3")).includes("white knight"), 15_000),
    await label(a, "f3"),
  );

  // The game kept: the reload shows it, its title, and it is still running.
  await a.reload();
  await openFromDock(a, "Chess", "Chess").catch(() => {});
  await board(a).waitFor({ state: "visible", timeout: 15_000 });
  step(
    "after a reload the game is open again",
    await until(async () => (await label(a, "f3")).includes("white knight"), 10_000),
  );
  step("the title names the players", (await title(a)).includes(martin.fullName), await title(a));
  await shot(a, "chess-rows-reloaded");

  // Resign from the menu, with a notification for the other player.
  await chooseMenu(a, "Game", "Resign");
  step(
    "Game > Resign ends the game",
    (await within(LIVE_MS, async () => /resigned/.test(await status(a)))) !== null,
    await status(a),
  );
  step(
    "Martin is told",
    (await within(LIVE_MS, async () =>
      JSON.stringify((await api(b, "GET", "/api/notification-center/inbox")).json).includes(
        "resigned. You win.",
      ),
    )) !== null,
  );

  // ---- Promotion -------------------------------------------------------------------------------
  const promoted = await invited(a, b, 0);
  const setUp = [
    [a, "a2", "a4"],
    [b, "b7", "b5"],
    [a, "a4", "b5"],
    [b, "a7", "a6"],
    [a, "b5", "a6"],
    [b, "c8", "b7"],
    [a, "a6", "b7"],
    [b, "h7", "h6"],
  ];
  for (const [index, [page, from, to]] of setUp.entries()) {
    const reply = await ply(page, promoted, index, from, to);
    if (reply.status !== 201) throw new Error(`${from}-${to}: ${reply.status} ${reply.text}`);
  }
  await a.reload();
  await openFromDock(a, "Chess", "Chess").catch(() => {});
  await within(LIVE_MS, async () => (await label(a, "b7")).includes("white pawn"));
  await move(a, "b7", "a8");
  const promotion = a.getByRole("dialog").filter({ hasText: /Queen/ });
  await promotion.waitFor({ timeout: 5_000 });
  await a.waitForTimeout(300);
  await shot(a, "chess-rows-promotion");
  await promotion.getByRole("button", { name: "Knight" }).click();
  await promotion.waitFor({ state: "hidden", timeout: 5_000 });
  step(
    "the promotion sheet makes the piece chosen",
    await until(async () => (await label(a, "a8")).includes("white knight"), 15_000),
    await label(a, "a8"),
  );

  // ---- A claimed draw, and replay ----------------------------------------------------------------
  const drawn = await invited(a, b, 0);
  const dance = [
    [a, "g1", "f3"],
    [b, "g8", "f6"],
    [a, "f3", "g1"],
    [b, "f6", "g8"],
    [a, "g1", "f3"],
    [b, "g8", "f6"],
    [a, "f3", "g1"],
    [b, "f6", "g8"],
  ];
  for (const [index, [page, from, to]] of dance.entries()) {
    const reply = await ply(page, drawn, index, from, to);
    if (reply.status !== 201) throw new Error(`${from}-${to}: ${reply.status} ${reply.text}`);
  }
  await a.reload();
  await openFromDock(a, "Chess", "Chess").catch(() => {});
  const claim = button(a, "Claim Draw");
  await claim.waitFor({ timeout: LIVE_MS });
  await a.waitForTimeout(300);
  await shot(a, "chess-rows-claim");
  await claim.click();
  step(
    "Claim Draw draws the game on the third repetition",
    (await within(LIVE_MS, async () => /claimed a draw/.test(await status(a)))) !== null,
    await status(a),
  );

  await chooseMenu(a, "Game", "Games…");
  const games = a.getByRole("dialog").filter({ hasText: "Games" });
  await games.waitFor({ timeout: 8_000 });
  await a.waitForTimeout(300);
  await shot(a, "chess-rows-games");
  await games
    .getByRole("button", { name: /^Replay/ })
    .first()
    .click();
  await games.waitFor({ state: "hidden", timeout: 8_000 });
  await a.waitForTimeout(300);
  await shot(a, "chess-rows-replay");
  // The drawn game ends where it began, on knights that went out and back: Next Move tells its
  // start from its end, and from any other game.
  const atStart = await until(
    async () =>
      (await label(a, "g1")).includes("white knight") &&
      !(await label(a, "f3")).includes("knight") &&
      (await title(a)).includes(martin.fullName),
    10_000,
  );
  await chooseMenu(a, "Moves", "Next Move");
  step(
    "Games > Replay opens that finished game from its start, and Next Move plays its first move",
    atStart &&
      (await until(
        async () =>
          (await label(a, "f3")).includes("white knight") &&
          !(await label(a, "g1")).includes("knight"),
        10_000,
      )),
    `${await label(a, "f3")}; ${await title(a)}`,
  );

  // ---- The Dock menu, and Help ------------------------------------------------------------------
  await a
    .getByRole("toolbar", { name: "Dock" })
    .getByRole("button", { name: "Chess", exact: true })
    .click({ button: "right" });
  const dockMenu = a.getByRole("menu", { name: "Chess" });
  await dockMenu.waitFor({ timeout: 5_000 });
  await a.waitForTimeout(300);
  await shot(a, "chess-rows-dock-menu");
  await dockMenu.getByRole("menuitem", { name: /^Games/ }).click();
  step(
    "the Dock menu opens Games",
    await games.waitFor({ timeout: 5_000 }).then(
      () => true,
      () => false,
    ),
  );
  await a.keyboard.press("Escape");
  await closeMenus(a);
  await chooseMenu(a, "Help", "Chess Help");
  step(
    "Help > Chess Help opens Help Viewer",
    await a
      .getByRole("region", { name: /Help/ })
      .first()
      .waitFor({ timeout: 8_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await a.waitForTimeout(400);
  await shot(a, "chess-rows-help");
});

#!/usr/bin/env node
// Chess's variants, played by two people and against the computer: Crazyhouse drops a piece taken,
// Losers refuses a move while a capture is there to make, and Suicide is played by the computer.
//
//   node e2e/chess-variants-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import { api } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";
import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("chess-variants");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `cvchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `cvmartin-${id}`, fullName: `Martin ${id}`, password };
const LIVE_MS = 20_000;

const windowOf = (page) => page.locator(".mac-chess").first();
const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();

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

  // ---- The variants -------------------------------------------------------------------------------
  const house = await invited(a, b, 0, "Crazyhouse");
  for (const [index, [page, from, to]] of [
    [a, "e2", "e4"],
    [b, "d7", "d5"],
    [a, "e4", "d5"],
    [b, "d8", "d5"],
  ].entries()) {
    const reply = await ply(page, house, index, from, to);
    if (reply.status !== 201) throw new Error(`${from}-${to}: ${reply.status} ${reply.text}`);
  }
  await a.reload();
  await openFromDock(a, "Chess", "Chess").catch(() => {});
  const inHand = a.getByRole("button", { name: "Drop white pawn, 1 in hand" });
  await inHand.waitFor({ timeout: LIVE_MS });
  await inHand.click();
  await a.waitForTimeout(300);
  await shot(a, "chess-variants-crazyhouse-hand");
  await square(a, "e4").click();
  step(
    "Crazyhouse drops the pawn taken, on the board and on the server",
    await until(async () => {
      const { json } = await api(a, "GET", `/api/chess/games/${house}`);
      return json.state.plies[4]?.drop === "pawn" && (await label(a, "e4")).includes("white pawn");
    }, 20_000),
    await label(a, "e4"),
  );
  await shot(a, "chess-variants-crazyhouse-dropped");
  await chooseMenu(a, "Game", "Resign");

  const losers = await invited(a, b, 0, "Losers");
  await ply(a, losers, 0, "e2", "e4");
  await ply(b, losers, 1, "d7", "d5");
  await within(LIVE_MS, async () => (await label(a, "d5")).includes("black pawn"));
  // The board refuses this itself: nothing goes to the server, so no refusal comes back.
  const asked = [];
  const heard = (request) => {
    if (request.url().includes(`/api/chess/games/${losers}/plies`)) asked.push(request.url());
  };
  a.on("request", heard);
  await move(a, "g1", "f3");
  const told = a.locator(".mac-chess .mac-chess-announcement");
  const refusedOnBoard = await until(
    async () => /cannot move to f3/.test((await told.first().textContent()) ?? ""),
    5_000,
  );
  a.off("request", heard);
  const after = (await api(a, "GET", `/api/chess/games/${losers}`)).json;
  step(
    "Losers refuses on the board a move while a capture is there to make",
    refusedOnBoard &&
      asked.length === 0 &&
      (await label(a, "g1")).includes("white knight") &&
      !(await label(a, "f3")).includes("knight") &&
      after.state.plies.length === 2,
    `${await label(a, "g1")}; ${after.state.plies.length} plies; ${asked.length} sent`,
  );
  await move(a, "e4", "d5");
  step(
    "and takes the capture",
    await until(async () => (await label(a, "d5")).includes("white pawn"), 15_000),
  );
  await a.waitForTimeout(300);
  await shot(a, "chess-variants-losers");
  await chooseMenu(a, "Game", "Resign");

  await chooseMenu(a, "Game", "New Game…");
  const suicideSheet = a.getByRole("dialog").filter({ hasText: "New Game" });
  await suicideSheet.waitFor({ timeout: 10_000 });
  await choose(a, "Opponent", "Computer");
  await choose(a, "Variant", "Suicide");
  await suicideSheet.getByRole("button", { name: "Start Game" }).click();
  await suicideSheet.waitFor({ state: "hidden", timeout: 8_000 });
  await move(a, "e2", "e4");
  step(
    "the computer answers in Suicide",
    await until(async () => (await newest(a))?.state?.plies?.length === 2, 20_000),
  );
  await a.waitForTimeout(300);
  await shot(a, "chess-variants-suicide");
});

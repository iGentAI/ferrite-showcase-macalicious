#!/usr/bin/env node
// Chess's Games sheet: choosing several games, Delete, and the row's menu with Open and Export.
//
//   node e2e/chess-games-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("chess-games", { ignoreOtherOrigins: true });

const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const sheet = (page) => page.getByRole("dialog", { name: "Games" });
const list = (page) => page.getByRole("list", { name: "Your games" });
const row = (page, index) => list(page).getByRole("listitem").nth(index);
const mine = async (page) => (await api(page, "GET", "/api/chess/mine")).json.games ?? [];
// By class: an open menu hides the list from the accessibility tree.
const chosenCount = (page) => page.locator(".mac-chess-games [data-chosen]").count();

async function startGame(page) {
  const dialog = page.getByRole("dialog", { name: "New Game" });
  // Until the window knows who the person is, the button says it is still connecting.
  await until(async () => {
    await page.locator(".mac-chess").first().getByRole("button", { name: "New Game…" }).click();
    return dialog.waitFor({ timeout: 1_000 }).then(
      () => true,
      () => false,
    );
  }, 15_000);
  await dialog.getByRole("button", { name: "Start Game" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 8_000 });
}

const openSheet = async (page) => {
  await page
    .locator(".mac-chess")
    .first()
    .getByRole("button", { name: /^Games/ })
    .click();
  await sheet(page).waitFor({ timeout: 8_000 });
  await until(async () => (await list(page).getByRole("listitem").count()) > 0, 5_000);
};

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".mac-chess-status").getByText("Choose New Game").waitFor({ timeout: 15_000 });

  for (let game = 0; game < 4; game++) {
    await startGame(page);
    await until(async () => (await mine(page)).length === game + 1, 8_000);
  }
  await square(page, "e2").click();
  await square(page, "e4").click();
  step(
    "four games on the list, one with a move and the computer's answer",
    await until(async () => {
      const games = await mine(page);
      return games.length === 4 && games[0].plies === 2;
    }, 20_000),
    JSON.stringify((await mine(page)).map((game) => game.plies)),
  );

  await openSheet(page);
  step("nothing is chosen at first, and Delete is dimmed", (await chosenCount(page)) === 0);
  await row(page, 0).locator(".mac-chess-game-text").click();
  await row(page, 2)
    .locator(".mac-chess-game-text")
    .click({ modifiers: ["ControlOrMeta"] });
  step("Command-click chooses a second row", (await chosenCount(page)) === 2);
  await row(page, 0)
    .locator(".mac-chess-game-text")
    .click({ modifiers: ["Shift"] });
  step("Shift-click reaches from the last row chosen", (await chosenCount(page)) === 3);
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "chess-games-chosen.png"));

  await row(page, 3).locator(".mac-chess-game-text").click({ button: "right" });
  const rowMenu = page.getByRole("menu", { name: "Game" });
  await rowMenu.waitFor({ timeout: 5_000 });
  step(
    "a secondary click on another row chooses it alone",
    await until(async () => (await chosenCount(page)) === 1, 3_000),
  );
  await page.waitForTimeout(200);
  await shot(page, path.join(out, "chess-games-menu.png"));
  await page.keyboard.press("Escape");
  await rowMenu.waitFor({ state: "hidden", timeout: 5_000 });
  await row(page, 0).locator(".mac-chess-game-text").click({ button: "right" });
  await rowMenu.getByRole("menuitem", { name: "Export…" }).click();
  const saved = sheet(page).getByRole("status");
  await saved.waitFor({ timeout: 8_000 });
  const said = await saved.innerText();
  const fileName = /“(.*)”/.exec(said)?.[1] ?? "";
  step("Export says where it put the file", fileName.endsWith(".pgn"), said);

  await list(page).focus();
  await page.keyboard.press("ControlOrMeta+a");
  step("Command-A chooses them all", (await chosenCount(page)) === 4);
  await row(page, 0).locator(".mac-chess-game-text").click();
  await row(page, 1)
    .locator(".mac-chess-game-text")
    .click({ modifiers: ["ControlOrMeta"] });

  const ids = (await mine(page)).map((game) => game.id);
  await sheet(page).getByRole("button", { name: "Delete…" }).click();
  const asked = sheet(page).getByText("Delete 2 games? This cannot be undone.");
  step("Delete asks first, naming how many", await asked.isVisible());
  await sheet(page).getByRole("button", { name: "Keep" }).click();
  step("Keep changes nothing", (await mine(page)).length === 4);

  await sheet(page).getByRole("button", { name: "Delete…" }).click();
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click();
  step(
    "Delete takes both games off the server",
    await until(async () => {
      const left = (await mine(page)).map((game) => game.id);
      return left.length === 2 && left[0] === ids[2] && left[1] === ids[3];
    }, 8_000),
    JSON.stringify((await mine(page)).map((game) => game.id)),
  );
  await until(async () => (await list(page).getByRole("listitem").count()) === 2, 5_000);

  await row(page, 1).locator(".mac-chess-game-text").click({ button: "right" });
  const statusLine = () => page.locator(".mac-chess-status").innerText();
  const NO_GAME = "Move a white piece to play the computer, or choose New Game for more options.";
  const stillNoGame = async () => (await statusLine()) === NO_GAME;
  step(
    "with the game shown deleted, the window shows no game",
    await stillNoGame(),
    await statusLine(),
  );
  await rowMenu.getByRole("menuitem", { name: "Open" }).click();
  await sheet(page).waitFor({ state: "hidden", timeout: 8_000 });
  step(
    "Open from the row's menu shows the game",
    await until(async () => !(await stillNoGame()), 5_000),
  );

  // ---- A row the server cannot read asks before it goes too --------------------------------------
  // Stand-in: this answer of the person's list is altered in the browser to call one game unreadable.
  const target = (await mine(page))[1].id;
  await page.route("**/api/chess/mine*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.games = body.games.map((game) =>
      game.id === target ? { id: game.id, status: "unreadable" } : game,
    );
    await route.fulfill({ response, json: body }).catch(() => {
      // The page stopped asking, or the route was taken away while this answer was on its way.
    });
  });
  await openSheet(page);
  const removeRow = sheet(page).getByRole("button", { name: "Remove", exact: true });
  await removeRow.click();
  step(
    "Remove on an unreadable game asks first",
    await sheet(page).getByText("Delete this game? This cannot be undone.").isVisible(),
  );
  await sheet(page).getByRole("button", { name: "Keep" }).click();
  step("Keep leaves it on the list", (await mine(page)).length === 2);
  await removeRow.click();
  await sheet(page).getByRole("button", { name: "Delete", exact: true }).click();
  step("Delete takes it off", await until(async () => (await mine(page)).length === 1, 8_000));
  await page.unroute("**/api/chess/mine*");
  await sheet(page).getByRole("button", { name: "Done" }).click();
  await sheet(page).waitFor({ state: "hidden", timeout: 8_000 });

  await reloadDesktop(page);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  step("over a reload the deleted games stay gone", (await mine(page)).length === 1);

  // ---- The exported file reads back, though its game has gone ------------------------------------
  await page.keyboard.press("ControlOrMeta+o");
  const panel = page.locator(".mac-chess-panel-layer");
  await panel.waitFor({ timeout: 5_000 });
  await panel.getByText("Downloads", { exact: true }).first().click();
  await panel.getByText(fileName, { exact: true }).first().click();
  await panel.getByRole("button", { name: "Open", exact: true }).click();
  await panel.waitFor({ state: "detached", timeout: 5_000 });
  const window = page.locator(".mac-chess").first();
  step(
    "the file holds the game's two moves",
    await until(
      async () =>
        (await page.locator(".mac-chess-status").innerText()).includes(`${fileName}: move 2 of 2`),
      8_000,
    ),
    await page.locator(".mac-chess-status").innerText(),
  );
  const pieceOn = async (name) => (await square(page, name).getAttribute("aria-label")) ?? "";
  step(
    "the file's first move is on the board",
    (await pieceOn("e4")).includes("white pawn") && !(await pieceOn("e2")).includes("pawn"),
    await pieceOn("e4"),
  );
  const titled = (await window.locator(".mac-title-bar").first().innerText()) ?? "";
  step("the file names its players", titled.includes("Guest User - Computer (level 4)"), titled);
});

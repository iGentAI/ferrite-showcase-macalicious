#!/usr/bin/env node
// Chess reading the game shown when the server does not answer: the status says so while it asks
// again, the game comes back when the server does, and a game the server no longer has leaves the
// window saying that. The failures are injected by the browser in front of the real server, on the
// one game's address.
//
//   node e2e/chess-load-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run, expectRefusal } = journey("chess-load", { ignoreOtherOrigins: true });

const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const status = (page) => page.locator(".mac-chess-status");

async function startGame(page) {
  const dialog = page.getByRole("dialog", { name: "New Game" });
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

await run(async (page) => {
  await openDesktop(page, base, step);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await status(page).getByText("Choose New Game").waitFor({ timeout: 15_000 });
  await startGame(page);
  await until(
    async () => ((await api(page, "GET", "/api/chess/mine")).json.games ?? []).length === 1,
  );
  const { id } = (await api(page, "GET", "/api/chess/mine")).json.games[0];
  const address = `/api/chess/games/${id}`;
  const isTheGame = (url) => new URL(url).pathname === address;

  // ---- The server does not answer, then does ------------------------------------------------------
  for (let answer = 0; answer < 30; answer += 1) expectRefusal(503, address);
  await page.route(isTheGame, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 503, body: "{}" })
      : route.continue(),
  );
  await reloadDesktop(page);
  await launch(page, "Chess");
  await status(page)
    .getByText("The game could not be read. Trying again…")
    .waitFor({ timeout: 20_000 });
  step("A game that cannot be read says so, not that it is opening", true);
  await shot(page, path.join(out, "chess-load-trying.png"));
  await page.unroute(isTheGame);
  step(
    "and comes back when the server answers",
    await until(
      async () => !/could not be read|Opening the game/.test(await status(page).innerText()),
      15_000,
    ),
    await status(page).innerText(),
  );

  // ---- The server no longer has it ----------------------------------------------------------------
  expectRefusal(404, address);
  await page.route(isTheGame, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 404, body: "{}" })
      : route.continue(),
  );
  await reloadDesktop(page);
  await launch(page, "Chess");
  await status(page)
    .getByText("This game is no longer on the server.")
    .waitFor({ timeout: 20_000 });
  step("A game the server no longer has says so, and is not left opening", true);
  await shot(page, path.join(out, "chess-load-gone.png"));
  await page.unroute(isTheGame);
});

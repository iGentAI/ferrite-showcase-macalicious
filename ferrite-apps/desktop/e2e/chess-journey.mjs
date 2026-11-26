#!/usr/bin/env node
// Chess on Ferrite, two people: Chris and Martin each make an account at the login window, in
// browsers of their own, and open Chess, which waits for a first move or New Game.
// Chris starts a game against the computer by moving a pawn, and the computer, whose
// search runs in a worker in his own browser, answers. Then Chris invites Martin by his account
// name; the invitation arrives live in Martin's Games, he accepts, and each move appears on the
// other's board without a reload. Chris resigns: both windows say Martin wins, and Chris
// replays the finished game from Games, stepping through its moves. Exits 0 only when every step passed
// and no page logged a console error, a page error, a failed request or an HTTP error.
//
//   node scripts/pack-site.mjs && ferrite dev     # in ferrite-apps/desktop
//   node e2e/chess-journey.mjs [--url http://127.0.0.1:8787] [--out e2e/output]
//                              [--browser chromium|chrome|firefox|webkit]

import { openFromDock, twoPeople, within } from "./people-kit.mjs";

const { step, run, shot } = twoPeople("chess");
const id = Date.now().toString(36);
const password = `tide-${id}-pool`;
const chris = { name: `chchris-${id}`, fullName: `Chris ${id}`, password };
const martin = { name: `chmartin-${id}`, fullName: `Martin ${id}`, password };
const LIVE_MS = 8_000;

const windowOf = (page) => page.locator(".mac-chess").first();
const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();
const title = async (page) =>
  (await windowOf(page).locator(".mac-chess-title").innerText()).replace(/\s+/g, " ").trim();
const button = (page, name) => windowOf(page).getByRole("button", { name, exact: true });

async function move(page, from, to) {
  await square(page, from).click();
  await square(page, to).click();
}

/** Choose `option` in the pop-up button named `name`. */
async function choose(page, name, option) {
  await page.getByRole("combobox", { name }).or(page.getByRole("button", { name })).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** How many black pieces have left their starting squares (ranks 7 and 8). */
async function blackMoved(page) {
  let away = 0;
  for (const file of "abcdefgh") {
    for (const rank of ["7", "8"]) {
      if (!(await label(page, `${file}${rank}`)).includes("black")) away += 1;
    }
  }
  return away;
}

await run({}, {}, async ({ person }) => {
  const a = await person("chris", chris);
  const b = await person("martin", martin);
  for (const page of [a, b]) {
    await openFromDock(page, "Chess", "Chess").catch(() => {});
    await board(page).waitFor({ state: "visible", timeout: 15_000 });
  }

  const empty = "Move a white piece to play the computer, or choose New Game for more options.";
  const waits = await within(15_000, async () => (await status(a)) === empty);
  step("Chris's window offers a first move", waits !== null, await status(a));

  // ── Against the computer ──
  await move(a, "e2", "e4");
  const started = await within(15_000, async () => (await title(a)).includes("Computer"));
  step("the opening move starts a game against the computer", started !== null, await title(a));
  const answered = await within(15_000, async () => (await blackMoved(a)) > 0);
  step("the computer answers Chris's move", answered !== null, `${answered} ms`);
  step(
    "the first move starts the strong computer game",
    (await title(a)).includes("Computer (level 4)"),
    await title(a),
  );
  step("Chris's pawn stands on e4", (await label(a, "e4")).includes("white pawn"));
  await shot(a, "chess-computer");

  // ── A reply closes only its own sheet: Start Game, Cancel, then Games while it is on its way ──
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const heldPath = (url) => new URL(url).pathname === "/api/chess/games";
  await a.route(heldPath, async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  await button(a, "New Game…").click();
  const pendingSheet = a.getByRole("dialog").filter({ hasText: "New Game" });
  await pendingSheet.waitFor({ timeout: 10_000 });
  await pendingSheet.getByRole("button", { name: "Start Game" }).click();
  await pendingSheet.getByRole("button", { name: "Cancel" }).click();
  await pendingSheet.waitFor({ state: "detached", timeout: 5_000 });
  await windowOf(a)
    .getByRole("button", { name: /^Games/ })
    .click();
  const openGames = a.getByRole("dialog").filter({ hasText: "Games" });
  await openGames.waitFor({ timeout: 10_000 });
  const gameRows = openGames.locator(".mac-chess-game-row");
  const rowsBefore = await gameRows.count();
  const answer = a.waitForResponse(
    (reply) => heldPath(reply.url()) && reply.request().method() === "POST",
  );
  release();
  const created = await answer;
  step("the held request creates the game", created.status() === 201 || created.status() === 200);
  const listed = await within(8_000, async () => (await gameRows.count()) === rowsBefore + 1);
  step(
    "the new game joins the open Games sheet",
    listed !== null,
    `${await gameRows.count()} rows`,
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  step("a game's reply leaves the Games sheet open", await openGames.isVisible());
  await a.waitForTimeout(450);
  await shot(a, "chess-games-sheet");
  await a.unroute(heldPath);
  await openGames
    .getByRole("button", { name: /Done|Close/ })
    .first()
    .click();
  await openGames.waitFor({ state: "detached", timeout: 5_000 });

  // ── Chris invites Martin ──
  await button(a, "New Game…").click();
  const sheet = a.getByRole("dialog").filter({ hasText: "New Game" });
  await sheet.waitFor({ timeout: 10_000 });
  await choose(a, "Opponent", "Another person");
  await sheet.getByRole("textbox", { name: "Account name" }).fill(martin.name);
  await sheet.getByRole("button", { name: "Send Invitation" }).click();
  const waiting = await within(10_000, async () => (await status(a)).includes("Waiting for"));
  step("Chris's window waits for Martin to accept", waiting !== null, await status(a));

  const gamesButton = windowOf(b).getByRole("button", { name: /^Games/ });
  const arrived = await within(LIVE_MS, async () => /\(1\)/.test(await gamesButton.innerText()));
  step("the invitation arrives live in Martin's window", arrived !== null, `${arrived} ms`);
  await gamesButton.click();
  const list = b.getByRole("dialog").filter({ hasText: "Games" });
  await list.waitFor({ timeout: 10_000 });
  step(
    "Martin's Games names Chris's invitation",
    (await list.innerText()).includes(chris.fullName),
  );
  await list.getByRole("button", { name: "Accept" }).click();
  const playing = await within(LIVE_MS, async () => (await title(b)).startsWith(chris.fullName));
  step("Martin plays Black against Chris", playing !== null, await title(b));

  // ── Moves cross between the two browsers ──
  const ready = await within(LIVE_MS, async () => !(await status(a)).includes("Waiting for"));
  step("Chris's window sees the invitation accepted", ready !== null, await status(a));
  await move(a, "e2", "e4");
  const e4 = await within(LIVE_MS, async () => (await label(b, "e4")).includes("white pawn"));
  step("Chris's e2-e4 appears on Martin's board", e4 !== null, `${e4} ms`);
  await move(b, "e7", "e5");
  const e5 = await within(LIVE_MS, async () => (await label(a, "e5")).includes("black pawn"));
  step("Martin's e7-e5 appears on Chris's board", e5 !== null, `${e5} ms`);
  // Martin may not move White.
  await move(b, "g1", "f3");
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  step("Martin cannot move Chris's knight", (await label(a, "g1")).includes("white knight"));
  await shot(a, "chess-live-chris");
  await shot(b, "chess-live-martin");

  // ── Chris resigns ──
  await button(a, "Resign").click();
  const result = `${chris.fullName} resigned. ${martin.fullName} wins.`;
  const resignedA = await within(LIVE_MS, async () => (await status(a)) === result);
  const resignedB = await within(LIVE_MS, async () => (await status(b)) === result);
  step("both windows say Martin wins", resignedA !== null && resignedB !== null, await status(b));

  // ── Chris replays the finished game from Games ──
  await windowOf(a)
    .getByRole("button", { name: /^Games/ })
    .click();
  const mine = a.getByRole("dialog").filter({ hasText: "Games" });
  await mine.waitFor({ timeout: 10_000 });
  await mine.getByRole("button", { name: new RegExp(`^Replay ${martin.fullName}`) }).click();
  const atStart = await within(LIVE_MS, async () => (await label(a, "e2")).includes("white pawn"));
  step("the replay starts from the first position", atStart !== null, await status(a));
  await button(a, "Next move").click();
  const stepped = await within(5_000, async () => (await label(a, "e4")).includes("white pawn"));
  step("Forward shows the first move", stepped !== null, await status(a));
  await shot(a, "chess-replay");
});

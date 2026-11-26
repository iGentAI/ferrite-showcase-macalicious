#!/usr/bin/env node
// Chess's 3D board and speakable commands, with real input: the board in perspective, moved by drag, click and keys, read back
// from the server; the camera dragged and kept; Rotate Board; Preferences choosing Flat and back. Then Listen for Spoken Commands.
//
// Stand-in: a headless browser has no microphone, so a stub replaces the browser's speech recognition and the journey hands it
// the words. Nothing was really heard: this proves what Chess does with words a recognizer reports, not recognition.
// A headless browser also has only a software renderer, which Chess refuses for 3D; the journey lets the page accept it.
//
//   node e2e/chess-rows-batch15-journey.mjs [--url http://127.0.0.1:8787] [--out <dir>]

import path from "node:path";
import { api, journey, launch, openDesktop, options, reloadDesktop, shot } from "./app-journey.mjs";
import { chooseMenu, until } from "./media-census-kit.mjs";

const { base, out } = options();
const { step, run } = journey("chess-rows-batch15", { ignoreOtherOrigins: true });
const SETTINGS = "/api/system-preferences/settings";

const windowOf = (page) => page.locator(".mac-chess").first();
const board = (page) => page.getByRole("grid", { name: "Chessboard" }).first();
const square = (page, name) => board(page).locator(`[role="gridcell"][data-square="${name}"]`);
const label = async (page, name) => (await square(page, name).getAttribute("aria-label")) ?? "";
const status = (page) => windowOf(page).locator(".mac-chess-status").innerText();
const scene = (page) => windowOf(page).locator(".mac-chess-scene");
const values = async (page) => (await api(page, "GET", SETTINGS)).json?.values ?? {};
const say = (page, ...words) => page.evaluate((all) => window.chessEar.say(all), words);

async function serverGame(page) {
  const mine = (await api(page, "GET", "/api/chess/mine")).json;
  const id = mine.games?.[0]?.id;
  return id ? (await api(page, "GET", `/api/chess/games/${id}`)).json.state : null;
}

/** Where a square's middle is on the screen: the transform maps it, so ask its four corners. */
const centre = async (page, name) => {
  const box = await square(page, name).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

async function drag(page, from, to) {
  const start = await centre(page, from);
  const end = await centre(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  return async () => page.mouse.up();
}

async function startGame(page, strength) {
  await windowOf(page).getByRole("button", { name: "New Game…", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "New Game" });
  await sheet.waitFor({ timeout: 10_000 });
  await sheet.getByRole("combobox", { name: "Strength" }).click();
  await page.getByRole("option", { name: strength, exact: true }).click();
  await sheet.getByRole("button", { name: "Start Game" }).click();
  await sheet.waitFor({ state: "detached", timeout: 15_000 });
}

/** How many pixels of a part of the page differ between two moments, by decoding two screenshots. */
async function changed(page, before, after) {
  return page.evaluate(
    async ([a, b]) => {
      const read = async (data) => {
        const bitmap = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${data}`)).blob(),
        );
        const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d");
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [one, two] = await Promise.all([read(a), read(b)]);
      let count = 0;
      for (let at = 0; at < one.length; at += 4) {
        if (Math.abs(one[at] - two[at]) + Math.abs(one[at + 1] - two[at + 1]) > 24) count += 1;
      }
      return count;
    },
    [before, after],
  );
}

const squareShot = async (page, name) => {
  const box = await square(page, name).boundingBox();
  const shotOf = await page.screenshot({ clip: box });
  return shotOf.toString("base64");
};

await run(async (page) => {
  await page.addInitScript(() => {
    // Stands in for the browser's speech recognition: the journey hands it words, see the top of this file.
    const ear = { live: null, said: [], starts: 0, stops: 0 };
    ear.say = (alternatives) => {
      ear.said.push(alternatives);
      const results = ear.said.map((each) =>
        Object.assign(
          each.map((transcript) => ({ transcript })),
          { isFinal: true },
        ),
      );
      ear.live?.onresult?.({ results });
    };
    class Recognition {
      start() {
        ear.starts += 1;
        ear.said = [];
        ear.live = this;
      }
      stop() {
        ear.stops += 1;
        if (ear.live === this) ear.live = null;
      }
    }
    window.webkitSpeechRecognition = Recognition;
    window.SpeechRecognition = Recognition;
    window.chessEar = ear;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function acceptSoftware(kind, settings) {
      return getContext.call(this, kind, { ...settings, failIfMajorPerformanceCaveat: false });
    };
  });

  await openDesktop(page, base, step);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);

  // ---- The 3D board ----------------------------------------------------------------------------
  step(
    "Chess opens on the 3D board",
    (await windowOf(page).getAttribute("data-board-view")) === "3d" &&
      (await scene(page).count()) === 1,
  );
  const near = (await square(page, "e1").boundingBox()).width;
  const far = (await square(page, "e8").boundingBox()).width;
  step("squares near the viewer are wider than far ones", near > far * 1.08, `${near} > ${far}`);
  step(
    "the flat silhouettes are gone; the 64 squares remain",
    (await board(page).locator(".mac-chess-piece").count()) === 0 &&
      (await board(page).locator('[role="gridcell"]').count()) === 64,
  );
  await shot(page, path.join(out, "chess-3d-start.png"));

  await startGame(page, "Level 1 (beginner)");
  await until(async () => (await status(page)).includes("White"), 8_000);
  const emptyBefore = await squareShot(page, "e4");
  const homeBefore = await squareShot(page, "e2");

  // A drag.
  const release = await drag(page, "e2", "e4");
  await page.waitForTimeout(200);
  step(
    "a dragged piece marks where it can go, and its shadow follows the pointer",
    (await windowOf(page).locator(".mac-chess-lifted").count()) === 1 &&
      (await square(page, "e4").getAttribute("data-target")) === "move",
  );
  await shot(page, path.join(out, "chess-3d-drag.png"));
  await release();
  step(
    "dropping it plays the move on the server",
    await until(async () => (await serverGame(page))?.plies?.[0]?.to === "e4", 8_000),
  );
  step("the pawn stands on e4", (await label(page, "e4")).includes("white pawn"));
  await until(async () => (await serverGame(page))?.plies?.length === 2, 15_000);
  await page.waitForTimeout(500);
  const pixelsTo = await changed(page, emptyBefore, await squareShot(page, "e4"));
  const pixelsFrom = await changed(page, homeBefore, await squareShot(page, "e2"));
  step(
    "the canvas draws the piece where it went and not where it was",
    pixelsTo > 200 && pixelsFrom > 200,
    `e4 ${pixelsTo}, e2 ${pixelsFrom} pixels changed`,
  );
  await shot(page, path.join(out, "chess-3d-moved.png"));

  // An illegal drop, click to move, keys.
  const plies = (await serverGame(page)).plies.length;
  await (await drag(page, "d2", "d7"))();
  await page.waitForTimeout(300);
  step(
    "an illegal drop changes nothing",
    (await serverGame(page)).plies.length === plies && (await label(page, "d2")).includes("pawn"),
  );
  await square(page, "g1").click();
  step(
    "a click on a piece marks its moves",
    (await square(page, "f3").getAttribute("data-target")) === "move",
  );
  await square(page, "f3").click();
  step(
    "a second click plays it on the server",
    await until(async () => (await serverGame(page))?.plies?.[plies]?.to === "f3", 8_000),
  );
  await until(async () => (await serverGame(page))?.plies?.length === plies + 2, 15_000);
  await square(page, "h2").focus();
  await page.keyboard.press("ArrowUp");
  const onH3 = await page.evaluate(() => document.activeElement?.dataset?.square);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  step(
    "keys walk the squares and play a move",
    onH3 === "h3" &&
      (await until(async () => (await serverGame(page))?.plies?.[plies + 2]?.to === "h3", 8_000)),
    onH3,
  );
  await until(async () => (await serverGame(page))?.plies?.length === plies + 4, 15_000);

  // The camera.
  const frame = await windowOf(page).locator(".mac-chess-stage").boundingBox();
  await page.mouse.move(frame.x + 20, frame.y + 40);
  await page.mouse.down();
  await page.mouse.move(frame.x + 120, frame.y - 20, { steps: 6 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  step(
    "a drag on the backdrop moves the camera and it is kept on the server",
    await until(async () => {
      const camera = (await values(page))["chess.camera"];
      return camera?.tilt === 46 && camera?.spin === 30;
    }, 5_000),
    JSON.stringify((await values(page))["chess.camera"]),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "chess-3d-camera.png"));
  const c3 = await centre(page, "c2");
  const seen = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("[data-square]")?.dataset.square,
    [c3.x, c3.y],
  );
  step("at the new angle a square is still hit at its middle", seen === "c2", seen);

  await reloadDesktop(page);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  step(
    "over a reload the camera stays",
    await until(
      async () =>
        (await scene(page).getAttribute("data-tilt")) === "46" &&
        (await scene(page).getAttribute("data-spin")) === "30",
      8_000,
    ),
  );

  // Rotate Board.
  const a1Before = await square(page, "a1").boundingBox();
  await chooseMenu(page, "View", "Rotate Board");
  await page.waitForTimeout(700);
  const a1After = await square(page, "a1").boundingBox();
  step(
    "Rotate Board turns the board around at this angle too",
    Math.hypot(a1After.x - a1Before.x, a1After.y - a1Before.y) > 200,
  );
  await shot(page, path.join(out, "chess-3d-rotated.png"));
  await chooseMenu(page, "View", "Rotate Board");
  await page.waitForTimeout(700);

  // Preferences.
  await chooseMenu(page, "Chess", "Preferences…");
  const prefs = page.getByRole("region", { name: "Chess Preferences" }).first();
  await prefs.waitFor({ timeout: 8_000 });
  await shot(page, path.join(out, "chess-3d-preferences.png"));
  const choose = async (name, option) => {
    await prefs.getByRole("combobox", { name }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await choose("View", "Flat");
  step(
    "View > Flat brings back the flat board and its silhouettes",
    await until(
      async () =>
        (await windowOf(page).getAttribute("data-board-view")) === null &&
        (await board(page).locator(".mac-chess-piece").count()) > 20 &&
        (await scene(page).count()) === 0,
      4_000,
    ),
  );
  const flat = await square(page, "e1").boundingBox();
  const flatFar = await square(page, "e8").boundingBox();
  step("the flat board's squares are all one size", Math.abs(flat.width - flatFar.width) < 1);
  await shot(page, path.join(out, "chess-flat-again.png"));
  await choose("View", "3D");
  await choose("Board", "Green");
  await choose("Pieces", "Ivory and Umber");
  step(
    "3D is kept, with the board and pieces chosen",
    await until(async () => {
      const kept = await values(page);
      return (
        kept["chess.boardView"] === "3d" &&
        kept["chess.boardStyle"] === "green" &&
        kept["chess.pieceStyle"] === "warm"
      );
    }, 5_000),
  );
  await page.waitForTimeout(300);
  await shot(page, path.join(out, "chess-3d-green.png"));

  // ---- Speakable commands ----------------------------------------------------------------------
  const ear = () => page.evaluate(() => window.chessEar.starts);
  step("nothing listens until it is allowed", (await ear()) === 0);
  const allow = prefs.getByRole("checkbox", { name: "Listen for Spoken Commands" });
  await allow.click();
  step(
    "the permission is kept on the server",
    await until(async () => (await values(page))["chess.speakCommands"] === true, 5_000),
  );
  // Preferences has the keyboard now, so Chess is not in front and does not listen.
  await windowOf(page).locator(".mac-chess-status").click();
  const listening = windowOf(page).locator(".mac-chess-listening");
  step(
    "in front, Chess listens and says so",
    await until(async () => (await listening.count()) === 1 && (await ear()) > 0, 5_000),
  );
  await shot(page, path.join(out, "chess-speak-listening.png"));

  const before = (await serverGame(page)).plies.length;
  await say(page, "knight to c3");
  step(
    "“knight to c3” plays on the server",
    await until(async () => (await serverGame(page))?.plies?.[before]?.to === "c3", 8_000),
  );
  await until(async () => (await serverGame(page))?.plies?.length === before + 2, 15_000);
  await say(page, "pawn a2 to a5");
  await page.waitForTimeout(200);
  step(
    "an illegal move is refused aloud in the status line, the server unchanged",
    (await status(page)) === "That is not a legal move: “pawn a2 to a5”." &&
      (await serverGame(page)).plies.length === before + 2,
    await status(page),
  );
  await shot(page, path.join(out, "chess-speak-refused.png"));
  await say(page, "take back move");
  step(
    "“take back move” takes back on the server",
    await until(async () => (await serverGame(page))?.plies?.length === before, 8_000),
  );
  await say(page, "show last move");
  await page.waitForTimeout(200);
  step(
    "“show last move” points at it",
    (await board(page).locator("[data-pointed]").count()) === 2,
  );
  await say(page, "rotate board");
  step(
    "“rotate board” turns the board",
    await until(async () => (await values(page))["chess.rotated"] === true, 5_000),
  );
  await say(page, "rotate board");
  await say(page, "banana");
  await page.waitForTimeout(100);
  step(
    "other talk gets the list of commands",
    /^Chess did not understand “banana”/.test(await status(page)),
  );
  await say(page, "new game");
  const sheet = page.getByRole("dialog", { name: "New Game" });
  await sheet.waitFor({ timeout: 5_000 });
  step("“new game” opens New Game", true);
  await page.waitForTimeout(200);
  step(
    "under a sheet it stops listening",
    (await listening.count()) === 0 && (await page.evaluate(() => window.chessEar.stops)) > 0,
  );
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached", timeout: 5_000 });

  // Off again: the Window menu brings Preferences to the front, and Chess, back in front, does not listen.
  await chooseMenu(page, "Window", "Chess Preferences");
  await allow.click();
  step(
    "switching it off is kept on the server",
    await until(async () => (await values(page))["chess.speakCommands"] === false, 5_000),
  );
  await windowOf(page).locator(".mac-chess-status").click();
  await page.waitForTimeout(200);
  step("switched off, Chess in front is not listening", (await listening.count()) === 0);

  // ---- Dimmed, in a browser with neither --------------------------------------------------------
  await page.addInitScript(() => {
    delete window.webkitSpeechRecognition;
    delete window.SpeechRecognition;
    HTMLCanvasElement.prototype.getContext = function getContext() {
      return null;
    };
  });
  await reloadDesktop(page);
  await launch(page, "Chess");
  await board(page).waitFor({ state: "visible", timeout: 15_000 });
  await chooseMenu(page, "Chess", "Preferences…");
  await prefs.waitFor({ timeout: 8_000 });
  const allowRow = prefs.getByRole("checkbox", { name: "Listen for Spoken Commands" });
  step(
    "with no recognizer the permission is dimmed with its reason",
    (await allowRow.getAttribute("aria-disabled")) === "true" &&
      /no speech recognizer/.test(
        (await allowRow.locator("xpath=ancestor-or-self::*[@title][1]").getAttribute("title")) ??
          "",
      ),
    await allowRow.locator("xpath=ancestor-or-self::*[@title][1]").getAttribute("title"),
  );
  const view = prefs.getByRole("combobox", { name: "View" });
  step(
    "with no WebGL the view is dimmed with its reason and the board is flat",
    /no WebGL/.test((await view.getAttribute("title")) ?? "") &&
      (await windowOf(page).getAttribute("data-board-view")) === null &&
      (await board(page).locator(".mac-chess-piece").count()) > 20,
    await view.getAttribute("title"),
  );
  await shot(page, path.join(out, "chess-dimmed.png"));
});

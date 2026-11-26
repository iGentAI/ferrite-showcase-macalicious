// @vitest-environment node
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";
import { type ApiCall, type LivePage, startLivePage } from "../../test/live-page";

/*
 * The Chess window playing the person's own games (`AccountChess` in chess-account.tsx), in a
 * real browser: the window is the real component, built as the desktop's Ferrite application
 * serves it (`/live.html?app=chess`, no open board named), and the server is the stand-in of
 * test/live-page.ts, which holds each request until the case answers it. That stand-in replaces
 * `ferrite-apps/desktop` only; e2e/chess-journey.mjs plays the same window against `ferrite dev`.
 */
const any = Object.values(ENGINES).some(installed);
const ME = "u-0123456789abc";
const THEM = "u-fedcba987654a";
const WAIT = { timeout: 15_000 };

requireEveryEngine("the Chess account tests");

let server: LivePage | undefined;
beforeAll(async () => {
  if (any) server = await startLivePage();
}, 120_000);
afterAll(async () => {
  await server?.close();
});

let games = 0;

/**
 * The Najdorf's poisoned pawn, 1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6
 * 7. f4 Qb6 8. Qd2 Qxb2 9. Rb1 Qa3: White to move, with both queens out and much to calculate.
 * The engine at level 4 takes about 0.6 s over it in Node, which a search on the page would
 * spend with the page stopped.
 */
const POISONED_PAWN = [
  ["e2", "e4"],
  ["c7", "c5"],
  ["g1", "f3"],
  ["d7", "d6"],
  ["d2", "d4"],
  ["c5", "d4"],
  ["f3", "d4"],
  ["g8", "f6"],
  ["b1", "c3"],
  ["a7", "a6"],
  ["c1", "g5"],
  ["e7", "e6"],
  ["f2", "f4"],
  ["d8", "b6"],
  ["d1", "d2"],
  ["b6", "b2"],
  ["a1", "b1"],
  ["b2", "a3"],
].map(([from, to]) => ({ from, to, author: ME }));

describe.each(Object.keys(ENGINES))("Chess between accounts in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext | undefined;
  let tab: Page;
  const page = () => server as LivePage;
  const posts = () => page().calls.filter((call) => call.method === "POST");
  const status = () => tab.locator(".mac-chess-status").innerText();
  const board = () => tab.getByRole("grid", { name: "Chessboard" });
  const square = (name: string) => board().locator(`[role="gridcell"][data-square="${name}"]`);
  const named = async (name: string) => (await square(name).getAttribute("aria-label")) ?? "";
  const id = (what: string) => `${engineName}-${what}-${++games}-${Date.now().toString(36)}`;

  /** Answers who this is and the person's list; every other call goes to `more`. */
  const person = (mine: unknown, more: (call: ApiCall) => void = () => undefined) => {
    page().handle = (call) => {
      if (call.path === "/api/chess/me") {
        call.reply(200, { author: ME, name: "chris", full_name: "Chris Carter" });
      } else if (call.path === "/api/chess/mine") {
        call.reply(200, mine);
      } else {
        more(call);
      }
    };
  };

  const open = async () => {
    await context?.close();
    context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    tab = await context.newPage();
    await tab.goto(`${page().origin}/live.html?app=chess`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    await board().waitFor({ state: "visible", timeout: 30_000 });
  };

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
  }, 180_000);

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  beforeEach(() => {
    server?.reset();
  });

  it.skipIf(!available)(
    "opens on the newest game still being played, and never starts a game of its own",
    async () => {
      const playing = id("playing");
      const state = {
        number: 1,
        plies: [{ from: "e2", to: "e4", author: ME }],
        white: ME,
        black: THEM,
        white_name: "Chris Carter",
        black_name: "Martin Example",
        invite: { from: "chris", to: "martin", by: ME, state: "accepted" },
      };
      person(
        {
          games: [
            { id: "older-over", status: "over", plies: 3 },
            { id: playing, status: "playing", plies: 1 },
          ],
          invitations: [],
        },
        (call) => {
          if (call.path === `/api/chess/games/${playing}`) call.reply(200, { version: 3, state });
        },
      );
      await open();
      await expect.poll(() => named("e4"), WAIT).toBe("e4, white pawn");
      await expect.poll(status, WAIT).toBe("Black to move.");
      expect(await tab.locator(".mac-chess-title").innerText()).toMatch(/^Chris Carter - Martin/);
      expect(posts()).toHaveLength(0);

      // With nothing being played, the board waits for New Game.
      server?.reset();
      person({ games: [{ id: "older-over", status: "over", plies: 3 }], invitations: [] });
      await open();
      await expect
        .poll(status, WAIT)
        .toBe("Move a white piece to play the computer, or choose New Game for more options.");
      await square("e2").click();
      expect(posts()).toHaveLength(0);
      expect(page().calls.some((call) => call.path.startsWith("/api/chess/games/"))).toBe(false);
    },
    120_000,
  );

  it.skipIf(!available)(
    "shows a move only once the server has it",
    async () => {
      const game = id("move");
      const state = {
        number: 1,
        plies: [],
        white: ME,
        black: THEM,
        white_name: "Chris Carter",
        black_name: "Martin Example",
        invite: { from: "chris", to: "martin", by: ME, state: "accepted" },
      };
      person({ games: [{ id: game, status: "playing", plies: 0 }], invitations: [] }, (call) => {
        if (call.method === "GET" && call.path === `/api/chess/games/${game}`) {
          call.reply(200, { version: 1, state });
        }
        // Plies are held until the case answers them.
      });
      await open();
      await expect.poll(status, WAIT).toBe("White to move.");
      await square("e2").click();
      await square("e4").click();
      await expect.poll(() => posts().length, WAIT).toBe(1);
      const [ply] = posts() as [ApiCall];
      expect(ply.path).toBe(`/api/chess/games/${game}/plies`);
      expect(ply.body).toEqual({ number: 1, ply: 0, from: "e2", to: "e4" });
      // Not on the board before the server answers.
      expect(await named("e4")).toBe("e4");
      expect(await named("e2")).toBe("e2, white pawn");
      ply.reply(201, {
        version: 2,
        state: { ...state, plies: [{ from: "e2", to: "e4", author: ME }] },
      });
      await expect.poll(() => named("e4"), WAIT).toBe("e4, white pawn");
      await expect.poll(status, WAIT).toBe("Black to move.");
    },
    120_000,
  );

  it.skipIf(!available)(
    "accepts an invitation, then hears the other player's move when the server says Chess changed",
    async () => {
      const game = id("invited");
      let state: Record<string, unknown> = {
        number: 1,
        plies: [],
        white: THEM,
        black: ME,
        white_name: "Martin Example",
        black_name: "Chris Carter",
        invite: { from: "martin", to: "chris", by: THEM, state: "pending" },
      };
      const summary = { id: game, status: "invited", opponent: "Martin Example", side: "black" };
      person({ games: [], invitations: [summary] }, (call) => {
        if (call.method === "GET" && call.path === `/api/chess/games/${game}`) {
          call.reply(200, { version: Number(state.v ?? 1), state });
        } else if (call.path === `/api/chess/games/${game}/accept`) {
          state = { ...state, invite: { ...(state.invite as object), state: "accepted" }, v: 2 };
          call.reply(200, { version: 2, state });
        }
      });
      await open();
      const games = tab.getByRole("button", { name: "Games (1)…" });
      await games.waitFor(WAIT);
      await games.click();
      const sheet = tab.getByRole("dialog").filter({ hasText: "Games" });
      await sheet.getByRole("button", { name: "Accept" }).click();
      await expect.poll(status, WAIT).toBe("White to move.");
      expect(posts().map((call) => call.path)).toEqual([`/api/chess/games/${game}/accept`]);
      // Martin moves in his browser: the server counts a change in Chris's Chess.
      state = { ...state, plies: [{ from: "d2", to: "d4", author: THEM }], v: 3 };
      await tab.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("macalicious:server-change", { detail: { app: "chess" } }),
        ),
      );
      await expect.poll(() => named("d4"), WAIT).toBe("d4, white pawn");
      await expect.poll(status, WAIT).toBe("Black to move.");
    },
    120_000,
  );

  it.skipIf(!available)(
    "keeps the page answering while the computer looks for its move, which it sends",
    async () => {
      const game = id("computer");
      const state = {
        number: 1,
        plies: POISONED_PAWN,
        white: ME,
        black: ME,
        white_name: "Computer (level 4)",
        black_name: "Chris Carter",
        computer: { side: "white", level: 4 },
      };
      let release: (() => void) | undefined;
      person({ games: [{ id: game, status: "playing", plies: 18 }], invitations: [] }, (call) => {
        if (call.method === "GET" && call.path === `/api/chess/games/${game}`) {
          // Held until the page's main thread is being watched.
          release = () => call.reply(200, { version: 1, state });
        }
      });
      await open();
      await expect.poll(() => release !== undefined, WAIT).toBe(true);
      // Watch the main thread while the computer thinks: a timer that asks to run every 16 ms records
      // the longest it had to wait, of the waits that began once the window said so. That leaves out
      // the board's first drawing, which is no part of the search and which software GL makes slow;
      // a search on the page starts COMPUTER_PAUSE_MS after that message, inside what is measured.
      await tab.evaluate(() => {
        const watch = window as unknown as { longest: number; ticking: boolean };
        watch.longest = 0;
        watch.ticking = true;
        let last = performance.now();
        let thinking = false;
        const tick = () => {
          const now = performance.now();
          if (thinking) watch.longest = Math.max(watch.longest, now - last);
          last = now;
          thinking = /thinking/.test(
            document.querySelector(".mac-chess-status")?.textContent ?? "",
          );
          if (watch.ticking) setTimeout(tick, 16);
        };
        setTimeout(tick, 16);
      });
      const started = Date.now();
      release?.();
      await expect.poll(status, WAIT).toBe("The computer is thinking…");
      await expect.poll(() => posts().length, { timeout: 30_000 }).toBe(1);
      const thought = Date.now() - started;
      const longest = await tab.evaluate(() => {
        const watch = window as unknown as { longest: number; ticking: boolean };
        watch.ticking = false;
        return watch.longest;
      });
      const [ply] = posts() as [ApiCall];
      expect(ply.path).toBe(`/api/chess/games/${game}/plies`);
      expect((ply.body as { ply: number }).ply).toBe(18);
      // The page never stopped for more than a few frames while the search ran (the parked draft
      // searched on the page and froze it for the whole search).
      expect(thought).toBeGreaterThan(300);
      expect(longest).toBeLessThan(150);
    },
    120_000,
  );

  it.skipIf(!available)(
    "takes a game the server cannot read off the list from Games",
    async () => {
      const broken = id("broken");
      let listed = true;
      page().handle = (call) => {
        if (call.path === "/api/chess/me") {
          call.reply(200, { author: ME, name: "chris", full_name: "Chris Carter" });
        } else if (call.path === "/api/chess/mine") {
          call.reply(200, {
            games: listed ? [{ id: broken, status: "unreadable" }] : [],
            invitations: [],
          });
        } else if (call.path === `/api/chess/games/${broken}/remove`) {
          listed = false;
          call.reply(200, { removed: broken });
        }
      };
      await open();
      await tab.getByRole("button", { name: "Games…" }).click();
      const sheet = tab.getByRole("dialog").filter({ hasText: "Games" });
      await sheet.getByText("A game the server cannot read").waitFor(WAIT);
      await sheet.getByRole("button", { name: "Remove" }).click();
      await sheet.getByText("Delete this game? This cannot be undone.").waitFor(WAIT);
      await sheet.getByRole("button", { name: "Keep" }).click();
      expect(posts()).toEqual([]);
      await sheet.getByRole("button", { name: "Remove" }).click();
      await sheet.getByRole("button", { name: "Delete", exact: true }).click();
      await sheet.getByText("No games yet.").waitFor(WAIT);
      expect(posts().map((call) => call.path)).toEqual([`/api/chess/games/${broken}/remove`]);
    },
    120_000,
  );
});

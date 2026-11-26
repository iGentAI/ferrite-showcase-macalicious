// @vitest-environment node
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";
import { type ApiCall, type LivePage, startLivePage } from "../../test/live-page";

/*
 * The live Chess window (`chess-live.tsx`) refusing a move, in a real browser: the window is the
 * real component, built as the desktop's Ferrite application serves it, and the server is the
 * stand-in of test/live-page.ts, which holds each request until the case answers it. That
 * stand-in replaces `ferrite-apps/desktop` only; e2e/live-journey.mjs plays the same window
 * against `ferrite dev`.
 *
 * The window's `refuse` says no while it is still connecting, while one of its writes is on its
 * way, and on the other player's turn. A refused move leaves the board as it was, sends nothing
 * and announces why; a refusal lifts once its cause has gone.
 */
const any = Object.values(ENGINES).some(installed);
const ME = "0123456789abcdef";
const WAIT = { timeout: 15_000 };

requireEveryEngine("the live Chess tests");

let server: LivePage | undefined;
beforeAll(async () => {
  if (any) server = await startLivePage();
}, 120_000);
afterAll(async () => {
  await server?.close();
});

let games = 0;

describe.each(Object.keys(ENGINES))("Live Chess in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext | undefined;
  let tab: Page;
  let game = "";
  const page = () => server as LivePage;
  const writes = () => page().calls.filter((call) => call.method === "POST");

  /** A new window, in a browser context of its own, on a game of its own that starts as `state`. */
  const open = async (state: unknown) => {
    await context?.close();
    game = `${engineName}-${++games}-${Date.now().toString(36)}`;
    page().publish(`/live/chess/${game}`, 1, state);
    context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    tab = await context.newPage();
    await tab.goto(`${page().origin}/live.html?app=chess&game=${game}`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    await board().waitFor({ state: "visible", timeout: 30_000 });
  };

  const board = () => tab.getByRole("grid", { name: "Chessboard" });
  const square = (name: string) => board().locator(`[role="gridcell"][data-square="${name}"]`);
  const named = async (name: string) => (await square(name).getAttribute("aria-label")) ?? "";
  const announced = () => tab.locator(".mac-chess-announcement").innerText();
  const move = async (from: string, to: string) => {
    await square(from).click();
    await square(to).click();
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
    "refuses a move on the other player's turn: the board stays, nothing is sent",
    async () => {
      page().handle = (call) => {
        if (call.path === "/api/chess/me") call.reply(200, { author: ME });
      };
      // Another browser plays White, and it is White's move.
      await open({ number: 1, plies: [], white: "another-browser", black: null });
      await expect.poll(() => page().calls.length, WAIT).toBeGreaterThanOrEqual(1);
      await move("e2", "e4");
      await expect.poll(announced, WAIT).toBe("It is the other player's move.");
      expect(await named("e2")).toBe("e2, white pawn");
      expect(await named("e4")).toBe("e4");
      expect(await square("e2").getAttribute("aria-selected")).not.toBe("true");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(writes()).toHaveLength(0);
    },
    120_000,
  );

  it.skipIf(!available)(
    "refuses a move and a new game while it is still connecting",
    async () => {
      // Who this browser is goes unanswered.
      page().handle = () => undefined;
      await open({ number: 1, plies: [], white: null, black: null });
      await move("e2", "e4");
      await expect
        .poll(announced, WAIT)
        .toBe("Still connecting to the server. Try again in a moment.");
      expect(await named("e4")).toBe("e4");
      await tab.getByRole("button", { name: "New Game" }).click();
      await expect
        .poll(announced, WAIT)
        .toBe("Still connecting to the server. Try again in a moment.");
      expect(writes()).toHaveLength(0);
    },
    120_000,
  );

  it.skipIf(!available)(
    "refuses every action while its move is on its way, and lets the next one through after",
    async () => {
      page().handle = (call) => {
        if (call.path === "/api/chess/me") call.reply(200, { author: ME });
        // Moves are held until the case answers them.
      };
      await open({ number: 1, plies: [], white: null, black: null });
      await expect.poll(() => page().calls.length, WAIT).toBeGreaterThanOrEqual(1);
      await move("e2", "e4");
      await expect.poll(() => writes().length, WAIT).toBe(1);
      const [first] = writes() as [ApiCall];
      expect(first.path).toBe(`/api/chess/games/${game}/plies`);
      expect(first.body).toEqual({ number: 1, ply: 0, from: "e2", to: "e4" });
      // Shown at once, while the server has not answered.
      await expect.poll(() => named("e4"), WAIT).toBe("e4, white pawn");

      await move("e7", "e5");
      await expect.poll(announced, WAIT).toBe("Waiting for the server to record the last change.");
      expect(await named("e7")).toBe("e7, black pawn");
      await tab.getByRole("button", { name: "New Game" }).click();
      await expect.poll(announced, WAIT).toBe("Waiting for the server to record the last change.");
      expect(await named("e4")).toBe("e4, white pawn");
      expect(writes()).toHaveLength(1);

      // The server records the move: Black's reply is this browser's to make too (its seat is
      // free), and goes out.
      first.reply(200, {
        version: 2,
        state: { number: 1, plies: [{ from: "e2", to: "e4", author: ME }], white: ME, black: null },
      });
      await expect
        .poll(async () => tab.locator(".mac-chess-title").innerText(), WAIT)
        .toMatch(/^You\b/);
      await move("e7", "e5");
      await expect.poll(() => writes().length, WAIT).toBe(2);
      expect(writes()[1]?.body).toEqual({ number: 1, ply: 1, from: "e7", to: "e5" });
      await expect.poll(() => named("e5"), WAIT).toBe("e5, black pawn");
    },
    120_000,
  );
});

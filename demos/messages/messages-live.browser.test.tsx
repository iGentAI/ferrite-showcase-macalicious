// @vitest-environment node
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";
import { type ApiCall, type LivePage, startLivePage } from "../../test/live-page";

/*
 * What the desktop's live Messages window (`messages-live.tsx`) does with each answer of the
 * server, in a real browser: the window is the real component, built as the desktop's Ferrite
 * application serves it, and the server is the stand-in of test/live-page.ts, which holds each
 * request until the case answers it. That stand-in replaces `ferrite-apps/desktop` only; the
 * application's own answers are held by its Rust tests and by e2e/live-journey.mjs, which runs
 * the window against `ferrite dev`.
 *
 * The cases cover the paths no journey reaches: a send the room confirms while its request is
 * still unanswered (it is stopped, and the queue moves on), a window closed while a message is
 * being resent (the resends stop), and the three ways a Try Again ends: the room does not have
 * the message's key (it is sent again, with the same key), the room has it (the message is taken
 * as delivered and dismissed from the pending ones, with nothing sent), and the room cannot be
 * read (it stays Not Delivered, and can be tried again).
 */
const any = Object.values(ENGINES).some(installed);
const ME = "0123456789abcdef";
/** Longer than Vitest's 5 s, for a machine that is busy with other work. */
const WAIT = { timeout: 15_000 };

requireEveryEngine("the live Messages tests");

let server: LivePage | undefined;
beforeAll(async () => {
  if (any) server = await startLivePage();
}, 120_000);
afterAll(async () => {
  await server?.close();
});

let rooms = 0;
const message = (seq: number, text: string, key?: string) => ({
  seq,
  author: ME,
  name: "Guest",
  text,
  at_ms: Date.now(),
  ...(key ? { key } : {}),
});

describe.each(Object.keys(ENGINES))("Live Messages in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext | undefined;
  let tab: Page;
  let room = "";
  const page = () => server as LivePage;
  // The room's posts; the window's conversations between accounts and its personal stream ask
  // other routes, which `serve` answers as absent.
  const posts = () =>
    page().calls.filter(
      (call) => call.method === "POST" && call.path.startsWith("/api/messages/rooms/"),
    );
  // The window reads the room once as it opens, which makes the person one of the room's members
  // (Notification Center); the reads a Try Again makes are the ones after that.
  const roomReads = () =>
    page().calls.filter(
      (call) => call.method === "GET" && call.path.startsWith("/api/messages/rooms/"),
    );
  const reads = () => roomReads().slice(1);

  /**
   * Answers who this session is, and gives every request about the room to `rest`; anything
   * else (the conversations between accounts, the personal stream's ticket, the address book)
   * is answered as absent. The room's feed starts empty.
   */
  const serve = (rest: (call: ApiCall) => void) => {
    page().handle = (call) => {
      if (call.path === "/api/messages/me") call.reply(200, { author: ME });
      else if (call.path.startsWith("/api/messages/rooms/")) rest(call);
      else call.reply(404, { error: "not in this test" });
    };
  };

  /** A new window, in a browser context of its own, talking in a room of its own. */
  const open = async () => {
    await context?.close();
    room = `${engineName}-${++rooms}-${Date.now().toString(36)}`;
    page().publish(`/live/messages/${room}`, 1, { messages: [] });
    context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    tab = await context.newPage();
    await tab.goto(`${page().origin}/live.html?app=messages&room=${room}`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    await tab.getByRole("log").waitFor({ state: "visible", timeout: 30_000 });
    await expect.poll(() => roomReads().length, WAIT).toBe(1);
  };

  /** The transcript: each bubble's text, and each status under one, in order. */
  const transcript = () =>
    tab.evaluate(() =>
      [...document.querySelectorAll('[role="log"] [role="listitem"]')].flatMap((item) => {
        const sender = item.querySelector(".mac-message-bubble-sender")?.textContent ?? "";
        const text = (item.textContent ?? "").slice(sender.length).replace(/\s+/g, " ").trim();
        if (item.classList.contains("mac-message-bubble")) return [text];
        if (item.classList.contains("mac-message-bubble-status")) return [`[${text}]`];
        return [];
      }),
    );

  const send = async (text: string) => {
    await tab.locator('textarea[aria-label="Message"]').click();
    await tab.keyboard.type(text);
    await tab.keyboard.press("Enter");
  };

  const tryAgain = () => tab.getByRole("button", { name: "Try Again" });

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
    "stops a send the room shows while its request is unanswered, and sends the next message",
    async () => {
      serve((call) => {
        // The first message's request is never answered; the second's is.
        if (call.method === "POST" && posts().length === 2) {
          call.reply(201, { message: message(2, "Second", call.key ?? undefined) });
        }
      });
      await open();
      await send("First");
      await send("Second");
      await expect.poll(() => posts().length, WAIT).toBe(1);
      const [first] = posts();
      expect(first?.body).toEqual({ text: "First" });
      // Queued behind the first, which holds the queue until it is answered or confirmed.
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(posts()).toHaveLength(1);
      expect(await transcript()).toEqual(["First", "Second"]);

      // The room shows the first message by its key, as the live feed would after a write
      // whose answer was lost: its request is aborted and the second goes out at once, long
      // before the first's 10 s attempt would have timed out. (In WebKit a request aborted
      // through `AbortSignal.any` was seen never to end, which held the queue; see `bounded`.)
      page().publish(`/live/messages/${room}`, 2, {
        messages: [message(1, "First", first?.key ?? undefined)],
      });
      await expect.poll(() => posts().length, { timeout: 5_000 }).toBe(2);
      expect(posts()[1]?.body).toEqual({ text: "Second" });
      expect(posts()[1]?.key).not.toBe(first?.key);
      await expect.poll(() => first?.abandoned, WAIT).toBe(true);
      await expect.poll(transcript, WAIT).toEqual(["First", "Second", "[Delivered]"]);
      // The first message was never sent again.
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(posts().filter((call) => call.key === first?.key)).toHaveLength(1);
    },
    120_000,
  );

  it.skipIf(!available)(
    "stops resending once the window is closed",
    async () => {
      // The server is down: every attempt answers 503, and the window resends with backoff.
      serve((call) => call.reply(503, { error: "down" }));
      await open();
      await send("Into the void");
      await expect.poll(() => posts().length, WAIT).toBeGreaterThanOrEqual(3);
      expect(new Set(posts().map((call) => call.key)).size).toBe(1);
      await tab.evaluate(() => (window as unknown as { __unmount: () => void }).__unmount());
      const sent = posts().length;
      // The next resend was due within 2 s; none comes.
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      expect(posts()).toHaveLength(sent);
    },
    120_000,
  );

  it.skipIf(!available)(
    "Try Again asks the room for the message's key first, then sends it again with the same key",
    async () => {
      serve((call) => {
        if (call.method === "POST" && posts().length === 1) {
          call.reply(400, { error: "refused" });
        } else if (call.method === "POST") {
          call.reply(201, { message: message(1, "Hello", call.key ?? undefined) });
        } else if (call.method === "GET") {
          call.reply(200, { version: 1, state: { messages: [] } });
        }
      });
      await open();
      await send("Hello");
      await expect.poll(transcript, WAIT).toEqual(["Hello", "[Not Delivered Try Again]"]);
      const key = posts()[0]?.key;
      expect(key).toBeTruthy();
      expect(reads()).toHaveLength(0);

      await tryAgain().click();
      await expect.poll(() => posts().length, WAIT).toBe(2);
      // The room was read first, and the message sent again with the key it was sent with.
      const calls = page().calls;
      const read = calls.indexOf(reads()[0] as ApiCall);
      expect(read).toBeGreaterThanOrEqual(0);
      expect(read).toBeLessThan(calls.indexOf(posts()[1] as ApiCall));
      expect(posts()[1]?.key).toBe(key);
      expect(posts()[1]?.body).toEqual({ text: "Hello" });
      await expect.poll(transcript, WAIT).toEqual(["Hello", "[Delivered]"]);
    },
    120_000,
  );

  it.skipIf(!available)(
    "Try Again that finds the message in the room dismisses it as delivered and sends nothing",
    async () => {
      serve((call) => {
        if (call.method === "POST") {
          // The write's outcome is unknown to the window: it says Not Delivered. The room
          // has the message all the same, and the feed has not said so yet.
          call.reply(409, { error: "conflict" });
        } else if (call.method === "GET") {
          call.reply(200, {
            version: 2,
            state: { messages: [message(7, "Made it", posts()[0]?.key ?? undefined)] },
          });
        }
      });
      await open();
      await send("Made it");
      await expect.poll(transcript, WAIT).toEqual(["Made it", "[Not Delivered Try Again]"]);

      await tryAgain().click();
      await expect.poll(() => reads().length, WAIT).toBe(1);
      await expect.poll(transcript, WAIT).toEqual(["Made it", "[Delivered]"]);
      expect(await tryAgain().count()).toBe(0);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(posts()).toHaveLength(1);
    },
    120_000,
  );

  it.skipIf(!available)(
    "Try Again while the room cannot be read leaves the message Not Delivered, to try again",
    async () => {
      let readable = false;
      serve((call) => {
        if (call.method === "POST" && posts().length === 1) {
          call.reply(400, { error: "refused" });
        } else if (call.method === "POST") {
          call.reply(201, { message: message(1, "Again", call.key ?? undefined) });
        } else if (call.method === "GET" && !readable) {
          call.reply(409, { error: "the stored room cannot be read, so it is left unchanged" });
        } else if (call.method === "GET") {
          call.reply(200, { version: 1, state: { messages: [] } });
        }
      });
      await open();
      await send("Again");
      await expect.poll(transcript, WAIT).toEqual(["Again", "[Not Delivered Try Again]"]);

      await tryAgain().click();
      await expect.poll(() => reads().length, WAIT).toBe(1);
      await expect.poll(transcript, WAIT).toEqual(["Again", "[Not Delivered Try Again]"]);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(posts()).toHaveLength(1);

      // Once the room reads again, Try Again sends it, with its first key.
      readable = true;
      await tryAgain().click();
      await expect.poll(() => posts().length, WAIT).toBe(2);
      expect(reads()).toHaveLength(2);
      expect(posts()[1]?.key).toBe(posts()[0]?.key);
      await expect.poll(transcript, WAIT).toEqual(["Again", "[Delivered]"]);
    },
    120_000,
  );
});

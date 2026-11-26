// @vitest-environment node
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";
import { type ApiCall, type LivePage, startLivePage } from "../../test/live-page";

/*
 * The FaceTime window of the desktop's Ferrite application (`FaceTimeLive` in
 * facetime-live.tsx) against the races of placing, answering and hanging up, in a real browser:
 * the window is the real component, built as the application serves it, and the server is the
 * stand-in of test/live-page.ts, which holds each request until the case answers it. No call
 * connects here (the stand-in carries no descriptions); e2e/facetime-journey.mjs connects two
 * browsers through `ferrite dev`.
 */
const any = Object.values(ENGINES).some(installed);
const WAIT = { timeout: 15_000 };
/** Each case's call has an id of its own, so a request a closing window sends late is not
 * taken for one of the next case's. */
let ID = "";
let cases = 0;

requireEveryEngine("the FaceTime call tests");

let server: LivePage | undefined;
beforeAll(async () => {
  if (any) server = await startLivePage();
}, 120_000);
afterAll(async () => {
  await server?.close();
});

/** A call between Ada (the person reading) and Martin, as the server would send it to Ada. */
function callOf(
  ada: { state: string; seat?: number; page?: string },
  martin: { state: string; seat?: number },
  ended_ms = 0,
) {
  const seat = (n?: number, page?: string) =>
    n === undefined ? null : { n, ...(page ? { page } : {}) };
  return {
    id: ID,
    kind: "video",
    created_ms: Date.now(),
    connected_ms: 0,
    ended_ms,
    links: [],
    members: [
      {
        name: "ada",
        full_name: "Ada Lovelace",
        state: ada.state,
        seat: seat(ada.seat, ada.page),
        joined_ms: 0,
        left_ms: 0,
        me: true,
      },
      {
        name: "martin",
        full_name: "Martin Example",
        state: martin.state,
        seat: seat(martin.seat),
        joined_ms: 0,
        left_ms: 0,
        me: false,
      },
    ],
  };
}

describe.each(Object.keys(ENGINES))("FaceTime calls in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext | undefined;
  let tab: Page;
  const page = () => server as LivePage;
  const posts = (suffix: string) =>
    page().calls.filter(
      (call) =>
        call.method === "POST" &&
        call.path.endsWith(suffix) &&
        (call.path === "/api/facetime/calls" || call.path.includes(ID)),
    );
  const facetime = () => tab.getByRole("region", { name: "FaceTime" }).first();
  const state = () => facetime().getAttribute("data-call-state");

  /**
   * Answers who this is and the person's calls (`calls()` decides what they are); every other
   * request goes to `more`, and is held when `more` does not answer it.
   */
  const person = (calls: () => unknown, more: (call: ApiCall) => void = () => undefined) => {
    page().handle = (call) => {
      if (call.path === "/api/facetime/me") {
        call.reply(200, { name: "ada", full_name: "Ada Lovelace" });
      } else if (call.path === "/api/contacts/people") {
        call.reply(200, { people: [] });
      } else if (call.path === "/api/messages/blocked") {
        call.reply(200, { blocked: [] });
      } else if (call.method === "GET" && call.path === "/api/facetime/calls") {
        call.reply(200, calls());
      } else {
        more(call);
      }
    };
  };
  const none = { recents: [], incoming: null, active: null };

  const open = async () => {
    await context?.close();
    context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    tab = await context.newPage();
    await tab.goto(`${page().origin}/live.html?app=facetime`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    await facetime().waitFor({ state: "visible", timeout: 30_000 });
  };

  const dial = async (name: string) => {
    await facetime().getByRole("textbox", { name: "Recipient" }).fill(name);
    await facetime().getByRole("button", { name: "Video", exact: true }).click();
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
    cases += 1;
    ID = `${cases.toString(16).padStart(8, "0")}${"a".repeat(24)}`;
  });

  // Each case's window is closed before the next begins: closing it hangs up, and that request
  // belongs to the case that opened it.
  afterEach(async () => {
    await context?.close();
    context = undefined;
  });

  it.skipIf(!available)(
    "sends an unanswered hang-up once more as the page goes away",
    async () => {
      let made: ReturnType<typeof callOf> | null = null;
      person(
        () => (made ? { ...none, active: { version: 1, state: made } } : none),
        (call) => {
          if (call.path === "/api/facetime/calls") {
            const own = (call.body as { page: string }).page;
            made = callOf({ state: "joined", seat: 1, page: own }, { state: "ringing" });
            call.reply(201, { version: 1, state: made });
          } else if (call.method === "GET" && made) {
            call.reply(200, { version: 1, state: made });
          }
          // The hang-up is held: the server never answers it.
        },
      );
      await open();
      await dial("martin");
      await expect.poll(state, WAIT).toBe("calling");
      await facetime().locator('[aria-label="Call"]').getByRole("button", { name: "End" }).click();
      await expect.poll(() => posts("/leave").length, WAIT).toBe(1);
      await tab.goto("about:blank");
      await expect.poll(() => posts("/leave").length, WAIT).toBe(2);
      expect(posts("/leave")[1]?.body).toEqual({ seat: 1 });
    },
    120_000,
  );

  it.skipIf(!available)(
    "sends a cancelled call no more, and leaves the call its late reply made",
    async () => {
      let made: ReturnType<typeof callOf> | null = null;
      person(
        () => (made ? { ...none, active: { version: 1, state: made } } : none),
        (call) => {
          if (call.path.endsWith("/leave")) {
            made = null;
            call.reply(200, {
              version: 2,
              state: callOf({ state: "left" }, { state: "missed" }, 1),
            });
          }
          // The placing is held until the case answers it.
        },
      );
      await open();
      await dial("martin");
      await expect.poll(() => posts("/api/facetime/calls").length, WAIT).toBe(1);
      const [placing] = posts("/api/facetime/calls") as [ApiCall];
      const pageToken = (placing.body as { page: string }).page;
      expect(placing.key).not.toBeNull();
      await expect.poll(state, WAIT).toBe("calling");
      // End while the request is on its way.
      await facetime().locator('[aria-label="Call"]').getByRole("button", { name: "End" }).click();
      await expect.poll(state, WAIT).toBe("idle");
      // The server placed the call after all, and its reply arrives late.
      made = callOf({ state: "joined", seat: 1, page: pageToken }, { state: "ringing" });
      placing.reply(201, { version: 1, state: made });
      // The window leaves it from the seat its page holds, and shows no call.
      await expect.poll(() => posts("/leave").length, WAIT).toBeGreaterThanOrEqual(1);
      expect(posts("/leave")[0]?.body).toEqual({ seat: 1 });
      expect(posts("/leave")[0]?.path).toBe(`/api/facetime/calls/${ID}/leave`);
      // Never sent again after End.
      expect(posts("/api/facetime/calls")).toHaveLength(1);
      expect(await state()).toBe("idle");
    },
    120_000,
  );

  it.skipIf(!available)(
    "takes up a call whose every reply was lost, rather than look idle while in it",
    async () => {
      let token = "";
      person(
        () =>
          token
            ? {
                ...none,
                active: {
                  version: 1,
                  state: callOf({ state: "joined", seat: 1, page: token }, { state: "ringing" }),
                },
              }
            : none,
        (call) => {
          if (call.path === "/api/facetime/calls") {
            // Each delivery reaches the server, which places the call, and every reply is lost.
            token = (call.body as { page: string }).page;
            call.reply(503, { error: "the reply was lost" });
          } else if (call.path === `/api/facetime/calls/${ID}`) {
            call.reply(200, {
              version: 1,
              state: callOf({ state: "joined", seat: 1, page: token }, { state: "ringing" }),
            });
          }
        },
      );
      await open();
      await dial("martin");
      // Every attempt carried the same key.
      await expect
        .poll(() => posts("/api/facetime/calls").length, { timeout: 30_000 })
        .toBeGreaterThanOrEqual(5);
      const keys = new Set(posts("/api/facetime/calls").map((call) => call.key));
      expect(keys.size).toBe(1);
      await expect.poll(state, { timeout: 30_000 }).toBe("calling");
      await expect
        .poll(() => facetime().locator('[aria-label="Call"]').innerText(), WAIT)
        .toContain("Martin Example");
      expect(posts("/leave")).toHaveLength(0);
    },
    120_000,
  );

  it.skipIf(!available)(
    "declining while an answer is on its way sends it no more, and leaves the call it joined",
    async () => {
      let joined: ReturnType<typeof callOf> | null = null;
      const ringing = callOf({ state: "ringing" }, { state: "joined", seat: 1 });
      person(
        () =>
          joined
            ? { ...none, active: { version: 3, state: joined } }
            : { ...none, incoming: { version: 1, state: ringing } },
        (call) => {
          if (call.path.endsWith("/decline")) {
            // The join reached the server first: the call is no longer ringing for Ada.
            call.reply(409, { error: "Only a call that rings for you can be declined." });
          } else if (call.path.endsWith("/leave")) {
            joined = null;
            call.reply(200, { version: 4, state: callOf({ state: "left" }, { state: "left" }, 1) });
          }
          // The join is held until the case answers it.
        },
      );
      await open();
      const panel = facetime().locator('[aria-label="Incoming call"]');
      await panel.waitFor(WAIT);
      expect(await panel.innerText()).toContain("Martin Example");
      await panel.getByRole("button", { name: "Accept" }).click();
      await expect.poll(() => posts("/join").length, WAIT).toBe(1);
      const [join] = posts("/join") as [ApiCall];
      const pageToken = (join.body as { page: string }).page;
      // The answer carries a key of its own, so a copy delivered late takes nothing back.
      expect(join.key).not.toBeNull();
      await panel.getByRole("button", { name: "Decline" }).click();
      await expect.poll(() => posts("/decline").length, WAIT).toBe(1);
      // The held join lands after all.
      joined = callOf({ state: "joined", seat: 2, page: pageToken }, { state: "joined", seat: 1 });
      join.reply(200, { version: 3, state: joined });
      await expect.poll(() => posts("/leave").length, WAIT).toBeGreaterThanOrEqual(1);
      expect(posts("/leave")[0]?.body).toEqual({ seat: 2 });
      expect(posts("/join")).toHaveLength(1);
      expect(await state()).not.toBe("calling");
    },
    120_000,
  );

  it.skipIf(!available)(
    "offers a call another window holds, and takes it up on a seat of its own only when asked",
    async () => {
      let joinedHere: ReturnType<typeof callOf> | null = null;
      const elsewhere = callOf(
        { state: "joined", seat: 2, page: "page-of-another-window" },
        { state: "joined", seat: 1 },
      );
      person(
        () => ({ ...none, active: { version: 1, state: joinedHere ?? elsewhere } }),
        (call) => {
          if (call.path.endsWith("/join")) {
            const page = (call.body as { page: string }).page;
            joinedHere = callOf({ state: "joined", seat: 3, page }, { state: "joined", seat: 1 });
            call.reply(200, { version: 2, state: joinedHere });
          } else if (call.path === `/api/facetime/calls/${ID}` && joinedHere) {
            call.reply(200, { version: 2, state: joinedHere });
          }
        },
      );
      await open();
      const panel = facetime().locator('[aria-label="Incoming call"]');
      await panel.waitFor(WAIT);
      expect(await panel.innerText()).toContain("In a call in another window");
      // Nothing is taken up, and nothing hung up, by itself.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      expect(
        page().calls.filter((call) => call.method === "POST" && call.path.includes(ID)),
      ).toHaveLength(0);
      await panel.getByRole("button", { name: "Join Here" }).click();
      await expect.poll(() => posts("/join").length, WAIT).toBe(1);
      const [join] = posts("/join") as [ApiCall];
      expect((join.body as { page: string }).page).not.toBe("page-of-another-window");
      await expect.poll(state, WAIT).toBe("calling");
    },
    120_000,
  );

  it.skipIf(!available)(
    "keeps the newer address book when an older answer arrives after it, and can call meanwhile",
    async () => {
      const held: ApiCall[] = [];
      person(
        () => none,
        (call) => {
          if (call.path === "/api/facetime/calls") {
            call.reply(201, {
              version: 1,
              state: callOf(
                { state: "joined", seat: 1, page: (call.body as { page: string }).page },
                { state: "ringing" },
              ),
            });
          }
        },
      );
      const answering = page().handle;
      page().handle = (call) => {
        if (call.path === "/api/contacts/people") held.push(call);
        else answering?.(call);
      };
      await open();
      await expect.poll(() => held.length, WAIT).toBe(1);
      await tab.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent("macalicious:server-change", { detail: { app: "contacts" } }),
        );
      });
      await expect.poll(() => held.length, WAIT).toBe(2);
      held[1]?.reply(200, { people: [{ user: "newer", full_name: "Newer Person" }] });
      await facetime().getByRole("textbox", { name: "Recipient" }).fill("Person");
      const offers = facetime().getByRole("group", { name: "Contacts" });
      await offers.getByRole("button", { name: "Newer Person" }).waitFor(WAIT);
      held[0]?.reply(200, { people: [{ user: "older", full_name: "Older Person" }] });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await offers.getByRole("button").allInnerTexts()).toEqual(["Newer Person"]);

      await facetime().getByRole("button", { name: "Video", exact: true }).click();
      await expect.poll(state, WAIT).toBe("calling");
    },
    120_000,
  );

  it.skipIf(!available)(
    "hangs up from its own seat when the window closes",
    async () => {
      person(
        () => none,
        (call) => {
          if (call.path === "/api/facetime/calls") {
            const page = (call.body as { page: string }).page;
            call.reply(201, {
              version: 1,
              state: callOf({ state: "joined", seat: 1, page }, { state: "ringing" }),
            });
          } else if (call.path.endsWith("/leave")) {
            call.reply(200, {
              version: 2,
              state: callOf({ state: "left" }, { state: "missed" }, 1),
            });
          }
        },
      );
      await open();
      await dial("martin");
      await expect.poll(state, WAIT).toBe("calling");
      await expect.poll(() => posts("/api/facetime/calls").length, WAIT).toBe(1);
      await tab.evaluate(() => (window as unknown as { __unmount(): void }).__unmount());
      await expect.poll(() => posts("/leave").length, WAIT).toBe(1);
      expect(posts("/leave")[0]?.body).toEqual({ seat: 1 });
    },
    120_000,
  );

  it.skipIf(!available)(
    "hangs up a call whose placing answers after the window closed",
    async () => {
      // The placing's reply is held until the window has closed: the call it names must still be
      // left, though no look follows a closed window.
      const held: { placing?: ApiCall } = {};
      person(
        () => none,
        (call) => {
          if (call.path === "/api/facetime/calls") {
            held.placing = call;
          } else if (call.path.endsWith("/leave")) {
            call.reply(200, {
              version: 2,
              state: callOf({ state: "left" }, { state: "missed" }, 1),
            });
          }
        },
      );
      await open();
      await dial("martin");
      await expect.poll(() => posts("/api/facetime/calls").length, WAIT).toBe(1);
      await tab.evaluate(() => (window as unknown as { __unmount(): void }).__unmount());
      const placing = held.placing;
      if (!placing) throw new Error("the placing request was not seen");
      const own = (placing.body as { page: string }).page;
      placing.reply(201, {
        version: 1,
        state: callOf({ state: "joined", seat: 1, page: own }, { state: "ringing" }),
      });
      await expect.poll(() => posts("/leave").length, WAIT).toBe(1);
      expect(posts("/leave")[0]?.body).toEqual({ seat: 1 });
    },
    120_000,
  );
});

// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";

/*
 * What only a browser can show: that a picture which loads takes the place of the initials,
 * that one which cannot be loaded leaves them, and that a new address shows them again until
 * its picture has arrived; and that the avatar keeps its name through all of it. The test
 * environment of the unit tests never loads an image.
 *
 * The example with three avatars is served by the visual harness's page (visual/harness) and
 * driven in each engine Playwright has installed; an engine that is not installed is skipped.
 * Set REQUIRE_BROWSER_TESTS=1 where the engines must be there (test/browser-engines.ts).
 */
/** The names of the engines that are installed here. */
const AVAILABLE = Object.keys(ENGINES).filter((name) => installed(ENGINES[name] as BrowserType));

const root = path.join(import.meta.dirname, "../../..");
const EXAMPLE = "src/components/avatar/examples/visual-pictures.tsx";
const WAIT = { timeout: 10_000 };
/** Room for a slow machine: a test's own waits come to less than this. */
const TIMEOUT = 60_000;

/** The picture the example asks for when its button is pressed; the test answers for the site. */
const NEXT = "**/avatar-next-picture.svg";
const NEXT_PICTURE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#34c759"/></svg>';

requireEveryEngine("the Avatar tests");

/** One server for the file: every engine loads the same page from it. */
let server: ViteDevServer | undefined;
let url: string;

beforeAll(async () => {
  if (AVAILABLE.length === 0) return;
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    // Its own cache: several servers that prepare dependencies in one folder disturb each other.
    cacheDir: path.join(root, "node_modules/.vite-browser-avatar"),
    server: { port: 0, host: "127.0.0.1", strictPort: false },
    logLevel: "silent",
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  url = `http://127.0.0.1:${port}/?example=${EXAMPLE}&appearance=light`;
}, 180_000);

afterAll(async () => {
  await server?.close();
});

describe.each(Object.keys(ENGINES))("Avatar in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser | undefined;
  let tab: Page;
  /** Lets the held picture through; set when the page asks for it. */
  let release: () => void = () => {};
  /** How the next picture is answered: with the picture, or as missing. */
  let answer: "picture" | "missing" = "picture";

  /** What one avatar shows and how it is named. */
  const shown = (id: string) =>
    tab.evaluate((avatarId) => {
      const avatar = document.getElementById(avatarId) as HTMLElement;
      const image = avatar.querySelector("img");
      return {
        // A picture counts when it is in the avatar, has loaded and is drawn.
        picture: Boolean(image?.complete && image.naturalWidth > 0 && image.checkVisibility()),
        initials: avatar.querySelector(".mac-avatar-fallback")?.textContent ?? null,
        role: avatar.getAttribute("role"),
        name: avatar.getAttribute("aria-label"),
      };
    }, id);

  /** The loading status the avatar last reported, from its cell in the example. */
  const status = (id: string) =>
    tab.evaluate(
      (avatarId) =>
        document
          .getElementById(avatarId)
          ?.closest("[data-avatar-status]")
          ?.getAttribute("data-avatar-status") ?? null,
      id,
    );

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    tab = await browser.newPage({ viewport: { width: 900, height: 700 } });
    // The site's answer for the next picture: held until the test lets it through.
    await tab.route(NEXT, async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      if (answer === "missing") await route.fulfill({ status: 404, body: "" });
      else await route.fulfill({ contentType: "image/svg+xml", body: NEXT_PICTURE });
    });
  }, 180_000);

  // Every test starts from a page that has just loaded.
  beforeEach(async () => {
    if (!available) return;
    answer = "picture";
    await tab.goto(url);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 180_000);

  afterAll(async () => {
    release();
    await browser?.close();
  });

  it.skipIf(!available)(
    "shows a picture that loads in place of the initials, and keeps the name",
    async () => {
      await expect
        .poll(() => shown("loads"), WAIT)
        .toEqual({ picture: true, initials: null, role: "img", name: "Aqua Bondi" });
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "keeps the initials when the picture cannot be loaded",
    async () => {
      // The avatar has handled the failure before the fallback is checked.
      await expect.poll(() => status("fails"), WAIT).toBe("error");
      await expect
        .poll(() => shown("fails"), WAIT)
        .toEqual({ picture: false, initials: "XY", role: "img", name: "Xavier Young" });
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "shows the initials again while a new picture loads, then the new picture",
    async () => {
      await expect.poll(async () => (await shown("changes")).picture, WAIT).toBe(true);
      const asked = tab.waitForRequest(NEXT);
      await tab.click("#next");
      await asked;
      // The new picture is held: the initials stand in, under the same name.
      await expect
        .poll(() => shown("changes"), WAIT)
        .toEqual({ picture: false, initials: "CD", role: "img", name: "Casey Dune" });
      release();
      await expect
        .poll(() => shown("changes"), WAIT)
        .toEqual({ picture: true, initials: null, role: "img", name: "Casey Dune" });
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "keeps the initials when the new picture is missing",
    async () => {
      answer = "missing";
      await expect.poll(async () => (await shown("changes")).picture, WAIT).toBe(true);
      const asked = tab.waitForRequest(NEXT);
      const answered = tab.waitForResponse(NEXT);
      await tab.click("#next");
      await asked;
      await expect.poll(async () => (await shown("changes")).initials, WAIT).toBe("CD");
      release();
      // Once the avatar has handled the missing picture, it still shows the initials.
      await answered;
      await expect.poll(() => status("changes"), WAIT).toBe("error");
      await expect
        .poll(() => shown("changes"), WAIT)
        .toEqual({ picture: false, initials: "CD", role: "img", name: "Casey Dune" });
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "shows the initials again when the picture is taken away after it has loaded",
    async () => {
      await expect.poll(() => status("changes"), WAIT).toBe("loaded");
      await expect.poll(async () => (await shown("changes")).picture, WAIT).toBe(true);
      await tab.click("#remove");
      // Without an address there is no image, and the fallback is back under the same name.
      await expect
        .poll(() => shown("changes"), WAIT)
        .toEqual({ picture: false, initials: "CD", role: "img", name: "Casey Dune" });
      await expect
        .poll(
          () =>
            tab.evaluate(() => {
              const fallback = document.querySelector("#changes .mac-avatar-fallback");
              return Boolean(
                fallback instanceof HTMLElement &&
                  fallback.checkVisibility() &&
                  fallback.offsetWidth,
              );
            }),
          WAIT,
        )
        .toBe(true);
      expect(await tab.locator("#changes img").count()).toBe(0);
    },
    TIMEOUT,
  );
});

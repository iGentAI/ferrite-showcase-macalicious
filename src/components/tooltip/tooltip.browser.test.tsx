// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";

/*
 * What only a browser can show: that a help tag appears when the Tab key of a real engine
 * brings the focus to its control, never takes the focus itself, and goes when Escape is
 * pressed or the focus moves on. The example with two controls is served by the visual
 * harness's page (visual/harness), which renders one example with the library's stylesheets,
 * and is driven with real input in each engine Playwright has installed (`npm run
 * visual:install` installs Chromium); an engine that is not installed is skipped. Set
 * REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then fails and names each
 * one that is missing (test/browser-engines.ts).
 */
/** The names of the engines that are installed here. */
const AVAILABLE = Object.keys(ENGINES).filter((name) => installed(ENGINES[name] as BrowserType));

const root = path.join(import.meta.dirname, "../../..");
const EXAMPLE = "src/components/tooltip/examples/controls.tsx";
const WAIT = { timeout: 10_000 };
/** Room for a slow machine: a test's own waits come to less than this. */
const TIMEOUT = 60_000;

/** The help tags of the example's two buttons. */
const REVERT = "Discard changes and go back to the last saved version";
const SAVE = "Save the document";

requireEveryEngine("the Tooltip tests");

/** One server for the file: every engine loads the same page from it. */
let server: ViteDevServer | undefined;
let url: string;

beforeAll(async () => {
  if (AVAILABLE.length === 0) return;
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    // Its own cache: several servers that prepare dependencies in one folder disturb each other.
    cacheDir: path.join(root, "node_modules/.vite-browser-tooltip"),
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

describe.each(Object.keys(ENGINES))("Tooltip in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser | undefined;
  let tab: Page;

  /** The text of every help tag that is shown: rendered, visible and not fully transparent. */
  const tags = () =>
    tab.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[role="tooltip"]')]
        .filter((tag) => tag.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
        .map((tag) => tag.textContent),
    );
  /** The text of the element that has the focus; the page itself has none. */
  const focused = () =>
    tab.evaluate(() =>
      document.activeElement === document.body ? null : document.activeElement?.textContent,
    );
  /**
   * Bring the focus to the first control with the keyboard and wait for its help tag. The key
   * is pressed only once the page is known to have nothing focused, so that Tab starts from
   * the top of the page and its first stop is the first control.
   */
  const focusRevert = async () => {
    await expect.poll(focused, WAIT).toBeNull();
    await tab.keyboard.press("Tab");
    await expect.poll(focused, WAIT).toBe("Revert");
    await expect.poll(tags, WAIT).toEqual([REVERT]);
  };

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    tab = await browser.newPage({ viewport: { width: 900, height: 700 } });
  }, 180_000);

  // Every test starts from a page that has just loaded, with nothing focused and no help tag.
  beforeEach(async () => {
    if (!available) return;
    await tab.goto(url);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "shows the help tag of the control the keyboard focuses, and leaves the focus there",
    async () => {
      expect(await tags()).toEqual([]);
      await focusRevert();
      expect(await focused()).toBe("Revert");
      // The tag is the control's description.
      const described = await tab.evaluate(() => {
        const id = document.activeElement?.getAttribute("aria-describedby");
        return id ? document.getElementById(id)?.textContent : null;
      });
      expect(described).toBe(REVERT);
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "hides on Escape, with the focus still on the control",
    async () => {
      await focusRevert();
      await tab.keyboard.press("Escape");
      await expect.poll(tags, WAIT).toEqual([]);
      expect(await focused()).toBe("Revert");
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "hides when the focus moves on, and the next control shows its own",
    async () => {
      await focusRevert();
      await tab.keyboard.press("Tab");
      await expect.poll(focused, WAIT).toBe("Save");
      await expect.poll(tags, WAIT).toEqual([SAVE]);
      // A press on the empty page takes the focus from the control, and no help tag is left.
      // (Tab past the last control is not used for this: where it sends the focus differs
      // between engines, and Firefox keeps it on the control.)
      await tab.mouse.click(890, 690);
      await expect.poll(focused, WAIT).toBeNull();
      await expect.poll(tags, WAIT).toEqual([]);
    },
    TIMEOUT,
  );
});

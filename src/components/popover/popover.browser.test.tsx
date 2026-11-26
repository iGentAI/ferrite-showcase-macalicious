// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../../test/browser-engines";

/*
 * What only a browser can show: where the focus really goes when a popover opens and closes,
 * and that a press on the page outside closes it, with the keys and the pointer of a real
 * engine instead of simulated events. The basic example is served by the visual harness's page
 * (visual/harness), which renders one example with the library's stylesheets, and is driven
 * with real input in each engine Playwright has installed (`npm run visual:install` installs
 * Chromium); an engine that is not installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where the
 * engines must be there: the run then fails and names each one that is missing
 * (test/browser-engines.ts).
 */
/** The names of the engines that are installed here. */
const AVAILABLE = Object.keys(ENGINES).filter((name) => installed(ENGINES[name] as BrowserType));

const root = path.join(import.meta.dirname, "../../..");
const EXAMPLE = "src/components/popover/examples/basic.tsx";
const WAIT = { timeout: 10_000 };
/** Room for a slow machine: a test's own waits come to less than this. */
const TIMEOUT = 60_000;

requireEveryEngine("the Popover tests");

/** One server for the file: every engine loads the same page from it. */
let server: ViteDevServer | undefined;
let url: string;

beforeAll(async () => {
  if (AVAILABLE.length === 0) return;
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    // Its own cache: several servers that prepare dependencies in one folder disturb each other.
    cacheDir: path.join(root, "node_modules/.vite-browser-popover"),
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

describe.each(Object.keys(ENGINES))("Popover in %s", (name) => {
  const engine = ENGINES[name] as BrowserType;
  const available = installed(engine);
  let browser: Browser | undefined;
  let tab: Page;

  const trigger = () => tab.getByRole("button", { name: "Show Event" });
  /** How many popovers are shown: in the document and visible. */
  const popovers = () => tab.locator(".mac-popover").filter({ visible: true }).count();
  /** Where the focus is: in the popover, on its trigger, or somewhere else on the page. */
  const focus = () =>
    tab.evaluate(() => {
      const active = document.activeElement;
      if (document.querySelector(".mac-popover")?.contains(active)) return "popover";
      return active?.textContent === "Show Event" ? "trigger" : "elsewhere";
    });
  /**
   * Open the popover with the keyboard and wait until it holds the focus: Base UI moves the
   * focus in after the popup is placed, and a key pressed before that goes to the trigger.
   */
  const open = async () => {
    await trigger().focus();
    await tab.keyboard.press("Enter");
    await expect.poll(focus, WAIT).toBe("popover");
  };

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    tab = await browser.newPage({ viewport: { width: 900, height: 700 } });
  }, 180_000);

  // Every test starts from a page that has just loaded, with the popover closed.
  beforeEach(async () => {
    if (!available) return;
    await tab.goto(url);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "moves the focus into the popover when the keyboard opens it",
    async () => {
      expect(await popovers()).toBe(0);
      await open();
      expect(await popovers()).toBe(1);
      expect(await tab.getByRole("dialog", { name: "Make Catalina Screenshots" }).isVisible()).toBe(
        true,
      );
      expect(await trigger().getAttribute("aria-expanded")).toBe("true");
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "closes on Escape and returns the focus to its trigger",
    async () => {
      await open();
      await tab.keyboard.press("Escape");
      await expect.poll(popovers, WAIT).toBe(0);
      await expect.poll(focus, WAIT).toBe("trigger");
      expect(await trigger().getAttribute("aria-expanded")).toBe("false");
    },
    TIMEOUT,
  );

  it.skipIf(!available)(
    "closes when the page outside it is pressed",
    async () => {
      await open();
      // The far corner of the page: neither the trigger nor the popover reaches it.
      await tab.mouse.click(890, 690);
      await expect.poll(popovers, WAIT).toBe(0);
      expect(await trigger().getAttribute("aria-expanded")).toBe("false");
    },
    TIMEOUT,
  );
});

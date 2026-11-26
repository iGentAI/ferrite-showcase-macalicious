// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show, because it needs layout: that Show all moves the focus to the
 * first result it adds without scrolling the list that is being read, and that the welcome
 * page's illustration stays inside a page narrower than its captured width. The window is
 * served by the visual harness's page (visual/harness) and driven with real input in each
 * engine Playwright has installed (`npm run visual:install` installs Chromium); an engine that
 * is not installed is skipped. Each case loads the page anew. Set REQUIRE_BROWSER_TESTS=1
 * where the engines must be there: the run then fails and names each one that is missing
 * (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const WAIT = { timeout: 15_000 };

requireEveryEngine("the Help Viewer tests");

// One server for the engines: each loads the same pages from it.
let server: ViteDevServer | undefined;
let origin = "";

beforeAll(async () => {
  if (!any) return;
  server = await createServer({
    configFile: path.join(root, "visual/vite.config.ts"),
    server: { port: 0, host: "127.0.0.1", strictPort: false },
    logLevel: "silent",
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address ? address.port : 5173;
  origin = `http://127.0.0.1:${port}`;
}, 60_000);

afterAll(async () => {
  await server?.close();
});

describe.each(Object.keys(ENGINES))("Help Viewer in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  /** The browser contexts the case opened: closed after it, whether it passed or not. */
  const contexts: BrowserContext[] = [];

  beforeAll(async () => {
    if (available) browser = await engine.launch();
  }, 60_000);

  afterEach(async () => {
    await Promise.all(contexts.splice(0).map((context) => context.close()));
  });

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * Loads an example of the demo in a page of its own, at the given width of the browser. The
   * harness shrinks its root to the example; `fill` gives the root the page's width instead,
   * for an example that takes the width it is given.
   */
  const open = async (example: string, width: number, fill = false): Promise<Page> => {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    contexts.push(context);
    const tab = await context.newPage();
    await tab.goto(`${origin}/?example=demos/help-viewer/examples/${example}.tsx&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    if (fill) {
      await tab.addStyleTag({ content: "#visual-root { display: block; }" });
      await tab.evaluate(() => window.__visualSettle());
    }
    return tab;
  };

  it.runIf(available)(
    "moves the focus to the first result Show all adds, and leaves the list where it was",
    async () => {
      // The hosted window is 500 pt high: six results and what follows them do not fit. Its
      // window manager is as wide as the page.
      const tab = await open("hosted", 1000, true);
      await tab.getByRole("searchbox", { name: "Search" }).click();
      await tab.keyboard.type("file");
      const links = tab.locator(".mac-help-viewer-result");
      await expect.poll(() => links.count(), WAIT).toBe(6);

      const viewport = tab.locator(".mac-help-viewer-scroll .mac-scroll-view-viewport");
      const more = tab.getByRole("button", { name: "Show all" });
      // The list is moved a little, so that there is a place to keep, and Show all, where the
      // first added result will be, is still under the visible part: taking the focus there
      // would scroll the list to show it.
      const before = await viewport.evaluate((element) => {
        element.scrollTop = 8;
        return element.scrollTop;
      });
      expect(before).toBe(8);
      const hidden = await more.evaluate((element) => {
        const list = element.closest(".mac-scroll-view-viewport") as HTMLElement;
        return element.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom;
      });
      expect(hidden).toBeGreaterThan(0);

      // Activated as the keyboard does it; a pointer would have to scroll to the button first.
      await more.evaluate((element) => (element as HTMLElement).click());
      await expect.poll(() => links.count(), WAIT).toBeGreaterThan(6);
      await expect
        .poll(
          () => links.nth(6).evaluate((element) => element === element.ownerDocument.activeElement),
          WAIT,
        )
        .toBe(true);
      const after = await viewport.evaluate((element) => element.scrollTop);
      expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
    },
    60_000,
  );

  it.runIf(available)(
    "keeps the welcome page's illustration inside a narrow page",
    async () => {
      // 600 pt of browser: the window is at its least width, and the page beside the table of
      // contents is narrower than the illustration's captured 387 pt.
      const tab = await open("basic", 600);
      const art = tab.locator(".mac-help-viewer-device-art");
      await art.waitFor(WAIT);
      const box = await art.evaluate((element) => {
        const body = element.closest(".mac-help-viewer-welcome-body") as HTMLElement;
        const style = getComputedStyle(body);
        const inside = body.getBoundingClientRect();
        const own = element.getBoundingClientRect();
        return {
          width: own.width,
          left: own.left,
          right: own.right,
          contentLeft: inside.left + Number.parseFloat(style.paddingLeft),
          contentRight: inside.right - Number.parseFloat(style.paddingRight),
        };
      });
      expect(box.width).toBeLessThan(387);
      expect(box.left).toBeGreaterThanOrEqual(box.contentLeft - 0.5);
      expect(box.right).toBeLessThanOrEqual(box.contentRight + 0.5);
    },
    60_000,
  );
});

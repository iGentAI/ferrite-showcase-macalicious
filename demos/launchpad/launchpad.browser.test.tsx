// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserContext, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show. The stage's size: jsdom lays nothing out, and the stage keeps
 * the screen's 1680 by 1050 proportion down to 672 pt wide and is 420 pt tall below that
 * (launchpad.mdx, "What it shows"). And the Dock's Launchpad tile under a real pointer: a
 * click on it while Launchpad shows hides Launchpad, also when the press has closed it
 * already, and a press that ends away from the tile does not decide what Return on it does
 * next. The example is served by the visual harness's page (visual/harness) in each engine
 * Playwright has installed; an engine that is not installed is skipped, unless
 * REQUIRE_BROWSER_TESTS is set (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/launchpad/examples/basic.tsx";

requireEveryEngine("the Launchpad tests");

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

describe.each(Object.keys(ENGINES))("Launchpad in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let context: BrowserContext;
  let tab: Page;

  const load = async () => {
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    // The harness shrink-wraps its root for screenshots; here the stage takes the page's width.
    await tab.evaluate(() => {
      const host = document.getElementById("visual-root");
      if (host) host.style.display = "block";
    });
  };

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    tab = await context.newPage();
    await load();
  }, 200_000);

  afterAll(async () => {
    await context?.close();
    await browser?.close();
  });

  const stage = () =>
    tab
      .locator(".mac-launchpad-demo")
      .evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);

  it.runIf(available)(
    "keeps the screen's proportion down to 672 pt wide and stays 420 pt tall below",
    async () => {
      await tab.setViewportSize({ width: 1200, height: 900 });
      const wide = await stage();
      expect(wide.width).toBeGreaterThan(672);
      expect(Math.abs(wide.height - (wide.width * 1050) / 1680)).toBeLessThan(1);

      await tab.setViewportSize({ width: 480, height: 900 });
      await expect.poll(async () => (await stage()).width).toBeLessThan(672);
      const narrow = await stage();
      expect(Math.abs(narrow.height - 420)).toBeLessThan(0.5);
      expect(narrow.height).toBeGreaterThan((narrow.width * 1050) / 1680);

      await tab.setViewportSize({ width: 1200, height: 900 });
    },
    60_000,
  );

  it.runIf(available)(
    "hides Launchpad on a click of its Dock tile, and shows it by Return after a press that ended elsewhere",
    async () => {
      await load();
      // While Launchpad shows the Dock is hidden from assistive technology: found by its label.
      const launchpadTile = tab.locator('.mac-launchpad-demo-dock [aria-label="Launchpad"]');
      const overlay = tab.getByRole("dialog", { name: "Launchpad", exact: true });
      const shown = () => overlay.count();
      // Launchpad fades in and out: wait for it to be there or gone.
      const settles = (count: number) => expect.poll(shown, { timeout: 5000 }).toBe(count);

      await launchpadTile.click();
      await settles(1);
      await launchpadTile.click();
      await settles(0);
      // It stays hidden: the click that followed the press did not show it again.
      await tab.waitForTimeout(500);
      expect(await shown()).toBe(0);

      // Down on the tile while Launchpad shows, up on the desktop: no click on the tile.
      await launchpadTile.click();
      await settles(1);
      const box = await launchpadTile.boundingBox();
      if (!box) throw new Error("The Launchpad tile has no box");
      await tab.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await tab.mouse.down();
      await tab.mouse.move(box.x + box.width / 2, box.y - 300, { steps: 5 });
      await tab.mouse.up();
      if ((await shown()) > 0) await tab.keyboard.press("Escape");
      await settles(0);

      // Return on the tile shows Launchpad.
      await launchpadTile.focus();
      await tab.keyboard.press("Enter");
      await settles(1);
    },
    60_000,
  );
});

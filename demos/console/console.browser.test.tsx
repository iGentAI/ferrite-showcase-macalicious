// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: Now and the table's own scrolling. While Now is on, the table
 * follows the newest message as the stream adds one every two seconds, and the scrolling it does
 * itself must not turn Now off. Scrolled away from the newest message by the scroll bar, or by
 * anything else that is not a wheel (a touch, the scroll bar's track), it lets go and stays
 * where it was put. The window is the demo's basic example, served by the visual harness's page
 * (visual/harness) with the library's stylesheets, in each engine Playwright has installed; an
 * engine that is not installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where the engines must
 * be there: the run then fails and names each one that is missing (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/console/examples/basic.tsx";
/** A little more than the stream's two seconds between messages. */
const ONE_MESSAGE = 2600;

requireEveryEngine("the Console tests");

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

describe.each(Object.keys(ENGINES))("Console's Now in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  /** Whether Now is on, as the toggle reports it. */
  const now = () => tab.getByRole("button", { name: "Now" }).getAttribute("aria-pressed");

  /**
   * The table's scrolling element now: how far it is scrolled, and whether the last row, the
   * newest message in the order of arrival, is in view whole under the header.
   */
  const table = () =>
    tab.evaluate(() => {
      const view = document.querySelector<HTMLElement>(
        ".mac-console-table > .mac-scroll-view-viewport",
      );
      if (!view) throw new Error("no table viewport");
      const rows = Number(view.parentElement?.getAttribute("aria-rowcount")) - 1;
      const top = (rows - 1) * 21;
      return {
        scrollTop: view.scrollTop,
        newestInView:
          view.scrollTop <= top + 1 && view.scrollTop >= top + 21 + 24 - view.clientHeight - 1,
      };
    });

  const open = async () => {
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  };

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    tab = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "follows the newest message as messages arrive, and stays on while it does",
    async () => {
      await open();
      expect(await now()).toBe("true");
      const first = await table();
      expect(first.scrollTop).toBeGreaterThan(0);
      expect(first.newestInView).toBe(true);
      // Two messages arrive; the table scrolls to each, and that scrolling keeps Now on.
      await tab.waitForTimeout(2 * ONE_MESSAGE);
      const later = await table();
      expect(later.scrollTop).toBeGreaterThan(first.scrollTop);
      expect(later.newestInView).toBe(true);
      expect(await now()).toBe("true");
    },
    200_000,
  );

  it.skipIf(!available)(
    "lets go when the scroll bar's knob is dragged up, and stays where it was put",
    async () => {
      await open();
      expect(await now()).toBe("true");
      // The overlay scroll bar takes the pointer once it is shown; the hook that the visual
      // tests use shows it, as the pointer resting on it would.
      await tab.evaluate(() =>
        document.querySelector(".mac-console-table")?.setAttribute("data-force", "hover"),
      );
      const knob = tab.locator(
        '.mac-console-table > .mac-scroll-view-scroller[data-orientation="vertical"] > .mac-scroll-view-knob',
      );
      const box = await knob.boundingBox();
      if (!box) throw new Error("the vertical knob is not drawn");
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const before = await table();
      await tab.mouse.move(x, y);
      await tab.mouse.down();
      await tab.mouse.move(x, y - 60, { steps: 6 });
      await tab.mouse.up();
      await expect.poll(now, { timeout: 2000 }).toBe("false");
      const dragged = await table();
      expect(dragged.scrollTop).toBeLessThan(before.scrollTop);
      expect(dragged.newestInView).toBe(false);
      // A message arrives, and the table stays where the knob left it.
      await tab.waitForTimeout(ONE_MESSAGE);
      expect((await table()).scrollTop).toBe(dragged.scrollTop);
      expect(await now()).toBe("false");
    },
    200_000,
  );

  it.skipIf(!available)(
    "lets go when the table is scrolled away without a wheel, as a touch or the track does",
    async () => {
      await open();
      expect(await now()).toBe("true");
      await tab.evaluate(() => {
        const view = document.querySelector<HTMLElement>(
          ".mac-console-table > .mac-scroll-view-viewport",
        );
        if (view) view.scrollTop = 0;
      });
      await expect.poll(now, { timeout: 2000 }).toBe("false");
      await tab.waitForTimeout(ONE_MESSAGE);
      expect((await table()).scrollTop).toBe(0);
    },
    200_000,
  );
});

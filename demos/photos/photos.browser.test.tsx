// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show: how the album's header lays out. At the captured width the
 * date range, the count, the two links and "Showing" stand on one line in a header of 75 pt;
 * in the narrowest window (760 pt) with the widest sidebar (320 pt) they wrap onto more lines
 * instead of running over each other or out of the pane, and the header grows to hold them.
 * The window is served by the visual harness's page (visual/harness) in each engine Playwright
 * has installed; an engine that is not installed is skipped. Set REQUIRE_BROWSER_TESTS=1 where
 * the engines must be there (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/photos/examples/basic.tsx";

requireEveryEngine("the Photos tests");

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

/** The header's boxes: the header, the row, and each item of the row. */
const layout = (tab: Page) =>
  tab.evaluate(() => {
    const box = (element: Element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    const header = document.querySelector(".mac-photos-header") as HTMLElement;
    const meta = header.querySelector(".mac-photos-meta") as HTMLElement;
    const grid = document.querySelector(".mac-photos-grid") as HTMLElement;
    return {
      header: box(header),
      meta: box(meta),
      grid: box(grid),
      items: [...meta.children].map(box),
    };
  });

type Box = { left: number; right: number; top: number; bottom: number };
const overlap = (a: Box, b: Box) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

describe.each(Object.keys(ENGINES))("Photos in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.runIf(available)(
    "keeps the header's row on one line at the captured width, and wraps it in the narrowest window",
    async () => {
      const window = tab.getByRole("region", { name: "My Albums" });
      await window.evaluate((element) => {
        (element as HTMLElement).style.width = "1200px";
      });
      const wide = await layout(tab);
      expect(wide.header.bottom - wide.header.top).toBeCloseTo(75, 0);
      // The date range stands where it is measured, 53.5 pt below the header's top.
      expect((wide.items[0] as Box).top - wide.header.top).toBeCloseTo(53.5, 1);
      // One line: every item's top within a point of the first.
      const first = wide.items[0] as Box;
      for (const item of wide.items) expect(Math.abs(item.top - first.top)).toBeLessThan(4);

      // The narrowest window, with the sidebar at its widest.
      await window.evaluate((element) => {
        (element as HTMLElement).style.width = "760px";
      });
      await tab.getByRole("separator", { name: "Resize the sidebar" }).focus();
      await tab.keyboard.press("End");
      await expect
        .poll(() =>
          tab.evaluate(
            () => (document.querySelector(".mac-photos-sidebar") as HTMLElement).offsetWidth,
          ),
        )
        .toBeGreaterThanOrEqual(319);

      const narrow = await layout(tab);
      // The row wrapped: its items stand on more than one line.
      const tops = new Set(narrow.items.map((item) => Math.round(item.top)));
      expect(tops.size).toBeGreaterThan(1);
      // Nothing runs out of the row or over another item.
      for (const item of narrow.items) {
        expect(item.left).toBeGreaterThanOrEqual(narrow.meta.left - 0.5);
        expect(item.right).toBeLessThanOrEqual(narrow.meta.right + 0.5);
      }
      narrow.items.forEach((item, index) => {
        for (const other of narrow.items.slice(index + 1)) expect(overlap(item, other)).toBe(false);
      });
      // The header grew to hold the lines, and the grid starts below it.
      expect(narrow.meta.bottom).toBeLessThanOrEqual(narrow.header.bottom + 0.5);
      expect(narrow.header.bottom - narrow.header.top).toBeGreaterThan(75);
      expect(narrow.grid.top).toBeGreaterThanOrEqual(narrow.header.bottom - 0.5);
    },
    60_000,
  );
});

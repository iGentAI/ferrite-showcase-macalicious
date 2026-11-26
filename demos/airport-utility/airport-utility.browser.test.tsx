// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What only a browser can show, and no screenshot does: the row of base stations when it is
 * wider than the window. It scrolls sideways; the line from the Internet stays under the
 * Internet and ends on the branch wherever the row is scrolled to; every base station hangs
 * from the branch; and a long name is cut off with an ellipsis while the node is still named
 * in full. The real window is served by the visual harness's page (visual/harness), which
 * renders one example with the library's stylesheets, and is measured in each engine
 * Playwright has installed (`npm run visual:install` installs Chromium); an engine that is not
 * installed is skipped. No case changes the window, so the engines share one server and each
 * keeps one page. Set REQUIRE_BROWSER_TESTS=1 where the engines must be there: the run then
 * fails and names each one that is missing (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/airport-utility/examples/stations.tsx";
const LONG = "Upstairs Reading Room and Workshop";

/** The first and the last of a row's base stations, which a row must have. */
function ends<T>(items: readonly T[]): { first: T; last: T } {
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) throw new Error("the row has no base station");
  return { first, last };
}

requireEveryEngine("the AirPort Utility tests");

// One server for the engines: each loads the same page from it.
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

describe.each(Object.keys(ENGINES))("AirPort Utility's base stations in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  /** Where the lines and the nodes are, in the page's points, after scrolling the row. */
  const measure = (scroll: "start" | "middle" | "end") =>
    tab.evaluate((to) => {
      const one = (selector: string) => {
        const found = document.querySelector<HTMLElement>(selector);
        if (!found) throw new Error(`nothing matches ${selector}`);
        return found;
      };
      const list = one(".mac-airport-utility-stations");
      const most = list.scrollWidth - list.clientWidth;
      list.scrollLeft = to === "start" ? 0 : to === "end" ? most : Math.round(most / 2);
      const trunk = one(".mac-airport-utility-trunk");
      const internet = one(".mac-airport-utility-internet .mac-airport-utility-node");
      const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
      const box = (element: Element) => element.getBoundingClientRect();
      const centre = (element: Element) => box(element).left + box(element).width / 2;
      const pseudo = (element: Element, which: "::before" | "::after") => {
        const style = getComputedStyle(element, which);
        return {
          content: style.content,
          top: Number.parseFloat(style.top),
          width: Number.parseFloat(style.width),
          height: Number.parseFloat(style.height),
          left: Number.parseFloat(style.left),
          right: Number.parseFloat(style.right),
          background: style.backgroundColor,
        };
      };
      return {
        most,
        scrolled: list.scrollLeft,
        trunkInList: list.contains(trunk),
        trunk: {
          left: box(trunk).left,
          top: box(trunk).top,
          bottom: box(trunk).bottom,
          width: box(trunk).width,
          background: getComputedStyle(trunk).backgroundColor,
        },
        internet: { centre: centre(internet), bottom: box(internet).bottom },
        items: items.map((item) => ({
          left: box(item).left,
          width: box(item).width,
          top: box(item).top,
          centre: centre(item),
          drop: pseudo(item, "::before"),
          branch: pseudo(item, "::after"),
        })),
      };
    }, scroll);

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
    tab = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.skipIf(!available)(
    "lays eight base stations out in one row that scrolls sideways",
    async () => {
      const start = await measure("start");
      expect(start.items).toHaveLength(8);
      // One row: every base station starts at the same height.
      expect(new Set(start.items.map((item) => item.top)).size).toBe(1);
      // Wider than the window, and really scrolled by what was asked for.
      expect(start.most).toBeGreaterThan(0);
      expect(start.scrolled).toBe(0);
      const end = await measure("end");
      expect(end.scrolled).toBeGreaterThan(0);
      expect(Math.abs(end.scrolled - end.most)).toBeLessThanOrEqual(1);
      // The row moved under the Internet by as much as it was scrolled.
      expect(ends(start.items).first.left - ends(end.items).first.left).toBeCloseTo(
        end.scrolled,
        0,
      );
      // Nothing is cut off at the start: the first base station lies inside the window.
      expect(ends(start.items).first.left).toBeGreaterThanOrEqual(24);
    },
  );

  it.skipIf(!available)(
    "keeps the line from the Internet under the Internet and on the branch, wherever the row is",
    async () => {
      const places = [await measure("start"), await measure("middle"), await measure("end")];
      const [atStart] = places;
      for (const now of places) {
        const { first, last } = ends(now.items);
        expect(now.trunkInList).toBe(false);
        // Under the Internet's centre, which does not move, and drawn.
        expect(now.trunk.width).toBe(1);
        expect(Math.abs(now.trunk.left - now.internet.centre)).toBeLessThanOrEqual(1);
        expect(now.trunk.left).toBe(atStart?.trunk.left);
        expect(now.trunk.background).not.toBe("rgba(0, 0, 0, 0)");
        // It starts just under the Internet's node, within 8 pt of its box, and ends on the
        // branch, which lies 12 pt over the base stations.
        expect(now.trunk.top - now.internet.bottom).toBeGreaterThanOrEqual(0);
        expect(now.trunk.top - now.internet.bottom).toBeLessThanOrEqual(8);
        expect(now.trunk.bottom).toBeCloseTo(first.top - 12, 0);
        // The branch reaches from the first base station's centre to the last one's: the
        // trunk's foot lies between them.
        expect(first.centre).toBeLessThanOrEqual(now.trunk.left);
        expect(last.centre).toBeGreaterThanOrEqual(now.trunk.left + now.trunk.width);
      }
    },
  );

  it.skipIf(!available)("hangs every base station from one unbroken branch", async () => {
    const { items, trunk } = await measure("start");
    items.forEach((item, index) => {
      // The drop: 1 pt wide and 12 pt high, from the branch to the node, at the node's centre.
      expect(item.drop.content).not.toBe("none");
      expect(item.drop.width).toBe(1);
      expect(item.drop.height).toBe(12);
      expect(item.drop.top).toBe(-12);
      expect(item.drop.left).toBeCloseTo(item.width / 2, 0);
      expect(item.drop.background).toBe(trunk.background);
      // The node's part of the branch: 1 pt high, at the drop's top, and reaching half of the
      // 36 pt gap towards each neighbour, so that the parts meet; at the row's two ends it
      // stops at the node's own centre.
      expect(item.branch.content).not.toBe("none");
      expect(item.branch.height).toBe(1);
      expect(item.branch.top).toBe(-12);
      expect(item.branch.background).toBe(trunk.background);
      const from = index === 0 ? item.width / 2 : -18;
      const to = index === items.length - 1 ? item.width / 2 : -18;
      expect(item.branch.left).toBeCloseTo(from, 0);
      expect(item.branch.right).toBeCloseTo(to, 0);
      // The parts meet: where this one ends, the next one starts.
      const next = items[index + 1];
      if (next) {
        expect(item.left + item.width - item.branch.right).toBeCloseTo(
          next.left + next.branch.left,
          0,
        );
      }
    });
  });

  it.skipIf(!available)(
    "cuts a long name off with an ellipsis and still names the node in full",
    async () => {
      // The node is found by all of its name, with its state in words.
      const node = tab.getByRole("button", { name: `${LONG}, Connected`, exact: true });
      expect(await node.count()).toBe(1);
      const label = await node.locator(".mac-airport-utility-label").evaluate((element) => ({
        text: element.textContent,
        shown: element.clientWidth,
        needed: element.scrollWidth,
        overflow: getComputedStyle(element).textOverflow,
      }));
      // All of the name is there; less than its width is shown, and the cut is an ellipsis.
      expect(label.text).toBe(LONG);
      expect(label.shown).toBeLessThanOrEqual(132);
      expect(label.needed).toBeGreaterThan(label.shown);
      expect(label.overflow).toBe("ellipsis");

      // A short name is shown whole.
      const short = await tab
        .getByRole("button", { name: "Hall, Connected", exact: true })
        .locator(".mac-airport-utility-label")
        .evaluate((element) => element.scrollWidth <= element.clientWidth);
      expect(short).toBe(true);
    },
  );

  it.skipIf(!available)(
    "keeps the line from the Internet on the branch in a window narrower than a base station",
    async () => {
      // A window too narrow for the first base station with the row's 24 pt on either side:
      // the graph keeps a width at which the first and the last station still lie on either
      // side of the Internet, and the window cuts off what it cannot show.
      const narrow = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      try {
        await narrow.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
        await narrow.waitForSelector("html[data-ready]", { timeout: 150_000 });
        for (const width of [100, 160, 220]) {
          for (const to of ["start", "middle", "end"] as const) {
            const now = await narrow.evaluate(
              ({ width, to }) => {
                const one = (selector: string) => {
                  const found = document.querySelector<HTMLElement>(selector);
                  if (!found) throw new Error(`nothing matches ${selector}`);
                  return found;
                };
                const frame = one(".mac-airport-utility");
                frame.style.width = `${width}px`;
                const list = one(".mac-airport-utility-stations");
                const most = list.scrollWidth - list.clientWidth;
                list.scrollLeft = to === "start" ? 0 : to === "end" ? most : Math.round(most / 2);
                const box = (element: Element) => element.getBoundingClientRect();
                const centre = (element: Element) => box(element).left + box(element).width / 2;
                const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
                const trunk = one(".mac-airport-utility-trunk");
                return {
                  frame: box(frame).width,
                  trunk: box(trunk).left,
                  internet: centre(one(".mac-airport-utility-internet .mac-airport-utility-node")),
                  first: centre(items[0] as HTMLElement),
                  last: centre(items[items.length - 1] as HTMLElement),
                  overflow: getComputedStyle(frame).overflow,
                  graph: box(one(".mac-airport-utility-graph")).width,
                  widest: Math.max(...items.map((item) => box(item).width)),
                };
              },
              { width, to },
            );
            const where = `${width} pt, scrolled to the ${to}`;
            // The window took the narrow width.
            expect(now.frame, where).toBeCloseTo(width, 0);
            // The graph is as wide as the widest base station with 24 pt on either side, and
            // the window, which clips, cuts off the rest.
            expect(now.graph, where).toBeGreaterThanOrEqual(now.widest + 48);
            expect(now.overflow, where).toBe("hidden");
            // The trunk is under the Internet and its foot lies on the branch.
            expect(Math.abs(now.trunk - now.internet), where).toBeLessThanOrEqual(1);
            expect(now.first, where).toBeLessThanOrEqual(now.trunk);
            expect(now.last, where).toBeGreaterThanOrEqual(now.trunk + 1);
          }
        }
      } finally {
        await narrow.close();
      }
    },
    180_000,
  );
});

// @vitest-environment node
import path from "node:path";
import type { Browser, BrowserType, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENGINES, installed, requireEveryEngine } from "../../test/browser-engines";

/*
 * What jsdom cannot show: events dragged with a real pointer in the week grid (calendar-drag.ts).
 * The example's window opens on the week of 3 October 2019, where "Make Catalina Screenshots" is
 * on Thursday from 2 PM to 4:45 PM, in the person's Work calendar, and the US Holidays calendar
 * (a subscription) holds Rosh Hashanah. Each engine Playwright has installed runs it; one that is
 * not installed is skipped unless REQUIRE_BROWSER_TESTS is set (test/browser-engines.ts).
 */
const any = Object.values(ENGINES).some(installed);

const root = path.join(import.meta.dirname, "../..");
const EXAMPLE = "demos/calendar/examples/basic.tsx";
const EVENT = "Make Catalina Screenshots";

requireEveryEngine("the Calendar drag tests");

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

describe.each(Object.keys(ENGINES))("Calendar's week grid in %s", (engineName) => {
  const engine = ENGINES[engineName] as BrowserType;
  const available = installed(engine);
  let browser: Browser;
  let tab: Page;

  beforeAll(async () => {
    if (!available) return;
    browser = await engine.launch();
  }, 200_000);

  afterAll(async () => {
    await browser?.close();
  });

  const load = async () => {
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    tab = await context.newPage();
    await tab.goto(`${origin}/?example=${EXAMPLE}&appearance=light`);
    await tab.waitForSelector("html[data-ready]", { timeout: 150_000 });
    // Noon at the top of the hours, so that the afternoon is in view.
    await tab.evaluate(() => {
      const hours = document.querySelector<HTMLElement>(
        ".mac-calendar-week-grid-scroll [role='group']",
      );
      const grid = document.querySelector<HTMLElement>(".mac-calendar-week-grid");
      const day = grid
        ? Number.parseFloat(getComputedStyle(grid).getPropertyValue("--_height"))
        : 0;
      if (hours) hours.scrollTop = (day / 24) * 12;
    });
  };

  const event = (title: string) =>
    tab.getByRole("button", { name: new RegExp(`^${title},`) }).first();
  const label = (title: string) => event(title).getAttribute("aria-label");
  /** One hour of the grid, and one day's column, in pixels. */
  const sizes = () =>
    tab.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".mac-calendar-week-grid");
      const column = document.querySelector(".mac-calendar-week-grid-column");
      const day = grid
        ? Number.parseFloat(getComputedStyle(grid).getPropertyValue("--_height"))
        : 0;
      return { hour: day / 24, column: column?.getBoundingClientRect().width ?? 0 };
    });
  /** A press at `y` within the event's block (`top`, `middle` or `bottom`), moved by dx and dy. */
  const drag = async (
    title: string,
    where: "top" | "middle" | "bottom",
    dx: number,
    dy: number,
  ) => {
    const box = await event(title).boundingBox();
    if (!box) throw new Error(`${title} is not shown`);
    const x = box.x + box.width / 2;
    const y =
      where === "top"
        ? box.y + 2
        : where === "bottom"
          ? box.y + box.height - 2
          : box.y + box.height / 2;
    await tab.mouse.move(x, y);
    await tab.mouse.down();
    await tab.mouse.move(x + dx / 2, y + dy / 2, { steps: 5 });
    await tab.mouse.move(x + dx, y + dy, { steps: 5 });
    await tab.mouse.up();
  };

  it.runIf(available)(
    "moves an event a day and an hour on when it is dragged, and changes its end or start when an edge is",
    async () => {
      await load();
      const { hour, column } = await sizes();
      expect(await label(EVENT)).toContain("Thursday, October 3, 2019, 2:00 PM".replace(":00", ""));

      await drag(EVENT, "middle", column, hour);
      await expect
        .poll(() => label(EVENT))
        .toBe(`${EVENT}, Friday, October 4, 2019, 3 PM \u2013 5:45 PM`);
      // The event dragged stays selected: the click that ends a drag clears nothing.
      expect(await event(EVENT).getAttribute("aria-pressed")).toBe("true");

      await drag(EVENT, "bottom", 0, hour / 2);
      await expect
        .poll(() => label(EVENT))
        .toBe(`${EVENT}, Friday, October 4, 2019, 3 PM \u2013 6:15 PM`);

      await drag(EVENT, "top", 0, -hour);
      await expect
        .poll(() => label(EVENT))
        .toBe(`${EVENT}, Friday, October 4, 2019, 2 PM \u2013 6:15 PM`);
      await tab.context().close();
    },
    200_000,
  );

  it.runIf(available)(
    "leaves an event where it was when Escape gives the drag up, or the press does not move",
    async () => {
      await load();
      const { hour, column } = await sizes();
      const before = await label(EVENT);
      const box = await event(EVENT).boundingBox();
      if (!box) throw new Error(`${EVENT} is not shown`);
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await tab.mouse.move(x, y);
      await tab.mouse.down();
      await tab.mouse.move(x + column, y + hour, { steps: 8 });
      await tab.keyboard.press("Escape");
      await tab.mouse.up();
      await expect.poll(() => label(EVENT)).toBe(before);
      // A click selects it and moves nothing.
      await event(EVENT).click();
      expect(await label(EVENT)).toBe(before);
      expect(await event(EVENT).getAttribute("aria-pressed")).toBe("true");
      await tab.context().close();
    },
    200_000,
  );

  it.runIf(available)(
    "does not move an event of a subscribed calendar",
    async () => {
      await load();
      const { column } = await sizes();
      const before = await label("Rosh Hashanah");
      await drag("Rosh Hashanah", "middle", column, 0);
      await tab.waitForTimeout(300);
      expect(await label("Rosh Hashanah")).toBe(before);
      await tab.context().close();
    },
    200_000,
  );
});
